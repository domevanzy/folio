import "server-only";
import { streamText, type ModelMessage } from "ai";
import { google } from "./model";
import { config } from "@/lib/config";
import { systemPrompt } from "./retrieval";
import { groundedParagraph, missingParagraphEvidence } from "./citations";
import type { Citation } from "@/lib/types";
import type { ChatStatus } from "@/lib/chat-stream";
type Options = {
  question: string;
  context: string;
  history: { role: "user" | "assistant"; content: string }[];
  citations: Citation[];
  signal: AbortSignal;
  onText: (text: string) => void;
  onStatus: (status: ChatStatus) => void;
};
export async function generateGroundedAnswer({
  question,
  context,
  history,
  citations,
  signal,
  onText,
  onStatus,
}: Options) {
  onStatus("generating");
  const messages: ModelMessage[] = [
    ...history.map((m) => ({
      role: m.role,
      content: m.content.slice(0, 6000),
    })),
    {
      role: "user",
      content: JSON.stringify({ question, untrusted_source_data: context }),
    },
  ];
  const result = streamText({
    model: google()(config.chatModel),
    system: systemPrompt,
    messages,
    maxOutputTokens: 4000,
    maxRetries: 0,
    abortSignal: signal,
    timeout: {
      totalMs: config.generationTimeoutMs,
      firstChunkMs: config.firstChunkTimeoutMs,
      chunkMs: config.chunkTimeoutMs,
    },
    providerOptions: config.chatModel.startsWith("gemini-3")
      ? { google: { thinkingConfig: { thinkingLevel: "low" } } }
      : undefined,
  });
  let content = "";
  let pending = "";
  const flush = (paragraph: string) => {
    if (!paragraph.trim()) return;
    onStatus("validating");
    const safe = groundedParagraph(paragraph, citations);
    if (safe === missingParagraphEvidence && content.endsWith(safe)) return;
    content += safe;
    onText(safe);
  };
  // textStream alone can end silently on provider errors: inspect the full event stream.
  for await (const event of result.fullStream) {
    signal.throwIfAborted();
    if (event.type === "error") throw event.error;
    if (event.type === "abort")
      throw new DOMException("Generation aborted", "AbortError");
    if (
      event.type === "finish" &&
      (event.finishReason === "error" || event.finishReason === "interrupted")
    )
      throw new Error("Unvollständiger Modell-Stream");
    if (event.type !== "text-delta") continue;
    pending += event.text;
    if (content.length + pending.length > 50000)
      throw new Error("Antwort zu lang");
    let boundary;
    while ((boundary = pending.indexOf("\n\n")) >= 0) {
      flush(pending.slice(0, boundary + 2));
      pending = pending.slice(boundary + 2);
    }
  }
  signal.throwIfAborted();
  if (pending.trim()) flush(pending);
  if (!content.trim()) throw new Error("Leere Modellantwort");
  return content;
}
