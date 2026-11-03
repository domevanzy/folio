import type { SourceKind } from "@/lib/types";
import { missingSourceKind } from "@/lib/http";
import {
  encodeChatEvent,
  CHAT_STREAM_CONTENT_TYPE,
  type ChatEvent,
} from "@/lib/chat-stream";
import "server-only";
import { z } from "zod";
import { generateGroundedAnswer } from "./generate";
import { chatFailure } from "@/lib/chat-errors";
import {
  notebookContext,
  rateLimit,
  acquireRequestSlot,
  checked,
  readJson,
  HttpError,
  failure,
} from "@/lib/http";
import { embedQuery } from "./model";
import { retrieve, makeContext } from "./retrieval";
import { validateCitations } from "./citations";
import { config } from "@/lib/config";
const schema = z.object({
  question: z.string().trim().min(1).max(3000).optional(),
  sourceIds: z.array(z.string().uuid()).min(1).max(40),
});
export async function answer(
  request: Request,
  notebookId: string,
  summary = false,
) {
  const cancellation = new AbortController();
  const signal = AbortSignal.any([
    request.signal,
    cancellation.signal,
    AbortSignal.timeout(config.chatRequestTimeoutMs),
  ]);
  let releaseSlot: (() => Promise<void>) | undefined;
  try {
    const { db, user } = await notebookContext(notebookId, request);
    const body = schema.parse(await readJson(request));
    if (!summary && !body.question)
      throw new HttpError(400, "Bitte eine Frage eingeben.");
    releaseSlot = await acquireRequestSlot(db, "model");
    await rateLimit(db, summary ? "summary" : "chat");
    const question = summary
      ? "Erstelle eine strukturierte Zusammenfassung der vorliegenden Auszüge. Nenne zentrale Themen, Kernaussagen und offene Fragen. Kennzeichne die Zusammenfassung ausdrücklich als auszugbasiert und möglicherweise unvollständig."
      : body.question!;
    const listSources = (fields: string) =>
      db
        .from("sources")
        .select(fields)
        .eq("notebook_id", notebookId)
        .eq("status", "ready")
        .in("id", body.sourceIds)
        .abortSignal(signal)
        .overrideTypes<
          Array<{ id: string; name: string; kind?: SourceKind }>,
          { merge: false }
        >();
    const result = await listSources("id,name,kind");
    const { data: sources } = checked(
      missingSourceKind(result.error) ? await listSources("id,name") : result,
    );
    if (sources?.length !== new Set(body.sourceIds).size)
      throw new HttpError(400, "Mindestens eine Quelle ist nicht verfügbar.");
    let rows: { source_id: string; page_number: number; content: string }[];
    if (summary) {
      const { data } = checked(
        await db
          .from("document_chunks")
          .select("source_id,page_number,content,chunk_index")
          .eq("notebook_id", notebookId)
          .in("source_id", body.sourceIds)
          .order("chunk_index")
          .limit(9600)
          .abortSignal(signal),
      );
      const groups = sources.map((s) =>
        (data || []).filter((c) => c.source_id === s.id),
      );
      rows = [];
      for (let i = 0; i < 5; i++)
        for (const group of groups) {
          if (group.length && rows.length < 40) {
            const row =
              group[Math.floor((i * Math.max(0, group.length - 1)) / 4)];
            if (!rows.includes(row)) rows.push(row);
          }
        }
    } else
      rows = await retrieve(
        db,
        notebookId,
        body.sourceIds,
        await embedQuery(question, signal),
        signal,
      );
    const { citations, context } = makeContext(
      rows,
      new Map(sources.map((s) => [s.id, s.name])),
      new Map(sources.map((s) => [s.id, s.kind ?? "pdf"])),
    );
    const { data: conversation } = checked(
      await db
        .from("conversations")
        .upsert(
          { notebook_id: notebookId, user_id: user.id },
          { onConflict: "notebook_id" },
        )
        .select("id")
        .abortSignal(signal)
        .single(),
    );
    if (!conversation) throw new Error("Conversation missing");
    const { data: history } = checked(
      await db
        .from("messages")
        .select("role,content")
        .eq("conversation_id", conversation.id)
        .eq("notebook_id", notebookId)
        .order("created_at", { ascending: false })
        .limit(8)
        .abortSignal(signal),
    );
    checked(
      await db.from("messages").insert({
        conversation_id: conversation.id,
        notebook_id: notebookId,
        user_id: user.id,
        role: "user",
        content: summary
          ? "Fasse die ausgewählten Quellen zusammen."
          : question,
      }),
    );
    const persist = async (content: string) => {
      const refs = validateCitations(content, citations).citations;
      const { data } = checked(
        await db
          .from("messages")
          .insert({
            conversation_id: conversation.id,
            notebook_id: notebookId,
            user_id: user.id,
            role: "assistant",
            content,
            citations: refs,
          })
          .select("id")
          .abortSignal(signal)
          .single(),
      );
      if (!data) throw new Error("Message missing");
      return { id: data.id, citations: refs };
    };
    if (!rows.length) {
      const content =
        "In den ausgewählten Quellen habe ich keine ausreichend passende Textstelle gefunden. Bitte formuliere die Frage anders oder wähle weitere Quellen aus.";
      const saved = await persist(content);
      return Response.json({ content, ...saved });
    }
    const releaseStreamSlot = releaseSlot;
    const stream = new ReadableStream({
      async start(controller) {
        let connected = true;
        const send = (event: ChatEvent) => {
          if (connected)
            try {
              controller.enqueue(encodeChatEvent(event));
            } catch {
              connected = false;
            }
        };
        try {
          const content = await generateGroundedAnswer({
            question,
            context,
            history: (history || []).reverse().map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            citations,
            signal,
            onText: (text) => send({ type: "text", text }),
            onStatus: (stage) => send({ type: "status", stage }),
          });
          signal.throwIfAborted();
          send({ type: "status", stage: "saving" });
          const saved = await persist(content);
          send({ type: "done", ...saved });
        } catch (error) {
          const failed = chatFailure(signal.aborted ? signal.reason : error);
          send({
            type: "error",
            error: failed.message + " Die Antwort wurde nicht gespeichert.",
          });
        } finally {
          await releaseStreamSlot();
          if (connected && !cancellation.signal.aborted) controller.close();
        }
      },
      cancel() {
        cancellation.abort();
      },
    });
    releaseSlot = undefined;
    return new Response(stream, {
      headers: {
        "Content-Type": CHAT_STREAM_CONTENT_TYPE,
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (
      error instanceof HttpError ||
      error instanceof z.ZodError ||
      error instanceof SyntaxError
    )
      return failure(error);
    const failed = chatFailure(signal.aborted ? signal.reason : error);
    return Response.json({ error: failed.message }, { status: failed.status });
  } finally {
    await releaseSlot?.();
  }
}
