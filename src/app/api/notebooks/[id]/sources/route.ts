import { documentStorage, removeDocumentFiles } from "@/lib/storage";
import { isValidPdfFile, PDF_UPLOAD_ERROR } from "@/lib/validation";
import { readLimited } from "@/lib/http";
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
    const length = Number(request.headers.get("content-length"));
    if (length > config.maxBytes + 100000)
      throw new HttpError(413, "Maximal 4 MiB pro Upload.");
    const payload = await readLimited(request, config.maxBytes + 100000);
    const form = await new Response(payload, {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || !isValidPdfFile(file))
      throw new HttpError(400, PDF_UPLOAD_ERROR);
    const pages = await extractPdf(new Uint8Array(await file.arrayBuffer()));
    const chunks = chunkPages(pages);
    if (chunks.length > config.maxChunks)
      throw new HttpError(
        400,
        "Zu viel Text: Bitte das Dokument in kleinere PDFs aufteilen.",
      );
    const sourceId = crypto.randomUUID();
    const path = `${user.id}/${id}/${sourceId}.pdf`;
    checked(
      await db.from("sources").insert({
        id: sourceId,
        notebook_id: id,
        user_id: user.id,
        name: file.name.slice(0, 180),
        storage_path: path,
        status: "processing",
        page_count: pages.length,
      }),
    );
    try {
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
      return Response.json(data, { status: 201 });
    } catch (error) {
      await db.from("document_chunks").delete().eq("source_id", sourceId);
      await removeDocumentFiles(db, [path]).catch(() => {});
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
