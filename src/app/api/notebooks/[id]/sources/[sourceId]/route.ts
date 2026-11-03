import { documentStorage, removeDocumentFiles } from "@/lib/storage";
import { notebookContext, failure, uuid, HttpError, checked } from "@/lib/http";
type Params = { params: Promise<{ id: string; sourceId: string }> };
async function source(request: Request, params: Params["params"]) {
  const { id, sourceId } = await params;
  uuid.parse(sourceId);
  const { db } = await notebookContext(id, request);
  const { data, error } = await db
    .from("sources")
    .select("*")
    .eq("id", sourceId)
    .eq("notebook_id", id)
    .single();
  if (error || !data) throw new HttpError(404, "Quelle nicht gefunden.");
  return { db, data };
}
export async function GET(request: Request, { params }: Params) {
  try {
    const { db, data } = await source(request, params);
    const headers = { "Cache-Control": "no-store" };
    if (data.kind === "text" || data.kind === "web")
      return Response.json(
        {
          kind: data.kind,
          content: data.content,
          originalUrl: data.original_url,
        },
        { headers },
      );
    const result = checked(
      await documentStorage(db).createSignedUrl(data.storage_path, 120),
    );
    return Response.json(
      { kind: "pdf", url: result.data!.signedUrl },
      { headers },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { db, data } = await source(request, params);
    if (data.storage_path) await removeDocumentFiles(db, [data.storage_path]);
    checked(await db.from("sources").delete().eq("id", data.id));
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
