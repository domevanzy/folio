import { documentStorage, removeDocumentFiles } from "@/lib/storage";
import {
  isValidPdfFile,
  PDF_UPLOAD_ERROR,
  writtenSourceSchema,
} from "@/lib/validation";
import { readJson, readLimited } from "@/lib/http";
import {
  notebookContext,
  failure,
  HttpError,
  rateLimit,
  checked,
} from "@/lib/http";
import { config } from "@/lib/config";
import { extractPdf } from "@/lib/rag/pdf";
import { chunkPages } from "@/lib/rag/chunk";
import { embedDocuments, google } from "@/lib/rag/model";
import { importWebSource } from "@/lib/rag/web-source";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { db, user } = await notebookContext(id, request);
    await rateLimit(db, "upload");
    google();
    const contentType = request.headers.get("content-type") || "";
    let file: File | undefined;
    let name: string;
    let content: string | null = null;
    let originalUrl: string | null = null;
    let kind: "pdf" | "text" | "web";
    let pages: string[];
    if (contentType.startsWith("application/json")) {
      const source = writtenSourceSchema.parse(
        await readJson(request, 650_000),
      );
      kind = source.kind;
      const written =
        source.kind === "web" ? await importWebSource(source.url) : source;
      ({ name, content } = written);
      originalUrl = "originalUrl" in written ? written.originalUrl : null;
      pages = [content];
    } else {
      const payload = await readLimited(request, config.maxBytes + 100000);
      const form = await new Response(payload, {
        headers: { "Content-Type": contentType },
      }).formData();
      const uploaded = form.get("file");
      if (!(uploaded instanceof File) || !isValidPdfFile(uploaded))
        throw new HttpError(400, PDF_UPLOAD_ERROR);
      file = uploaded;
      name = file.name;
      kind = "pdf";
      pages = await extractPdf(new Uint8Array(await file.arrayBuffer()));
    }
    const chunks = chunkPages(pages);
    if (chunks.length > config.maxChunks)
      throw new HttpError(
        400,
        "Zu viel Text. Bitte teile die Quelle in kleinere Abschnitte.",
      );
    const sourceId = crypto.randomUUID();
    const path = file ? `${user.id}/${id}/${sourceId}.pdf` : null;
    checked(
      await db.from("sources").insert({
        id: sourceId,
        notebook_id: id,
        user_id: user.id,
        name: name.slice(0, 180),
        ...(kind === "pdf" ? {} : { kind, content, original_url: originalUrl }),
        storage_path: path,
        status: "processing",
        page_count: pages.length,
      }),
    );
    try {
      if (path && file)
        checked(
          await documentStorage(db).upload(path, file, {
            contentType: "application/pdf",
            upsert: false,
          }),
        );
      for (let start = 0; start < chunks.length; start += 24) {
        const batch = chunks.slice(start, start + 24);
        const embeddings = await embedDocuments(batch.map((c) => c.content));
        checked(
          await db.from("document_chunks").insert(
            batch.map((chunk, i) => ({
              ...chunk,
              embedding: embeddings[i],
              notebook_id: id,
              source_id: sourceId,
              user_id: user.id,
            })),
          ),
        );
      }
      const { data } = checked(
        await db
          .from("sources")
          .update({ status: "ready" })
          .eq("id", sourceId)
          .select("id,name,status,page_count,error,created_at")
          .single(),
      );
      return Response.json({ ...data, kind }, { status: 201 });
    } catch (error) {
      await db.from("document_chunks").delete().eq("source_id", sourceId);
      if (path) await removeDocumentFiles(db, [path]).catch(() => {});
      await db
        .from("sources")
        .update({
          status: "failed",
          error:
            "Verarbeitung fehlgeschlagen. Bitte löschen und erneut hochladen.",
        })
        .eq("id", sourceId);
      throw error;
    }
  } catch (error) {
    return failure(error);
  }
}
