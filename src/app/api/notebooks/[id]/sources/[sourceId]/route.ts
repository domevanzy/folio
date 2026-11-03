import {
  documentStorage,
  ownedDocumentPath,
  removeDocumentFiles,
} from "@/lib/storage";
import { notebookContext, failure, uuid, HttpError, checked } from "@/lib/http";
type Params = { params: Promise<{ id: string; sourceId: string }> };
async function source(request: Request, params: Params["params"]) {
  const { id, sourceId } = await params;
  uuid.parse(sourceId);
  const { db, user, notebook } = await notebookContext(id, request);
  const { data, error } = await db
    .from("sources")
    .select("*")
    .eq("id", sourceId)
    .eq("notebook_id", notebook.id)
    .eq("user_id", user.id)
    .single();
  if (error || !data) throw new HttpError(404, "Quelle nicht gefunden.");
  return { db, data, userId: user.id, notebookId: notebook.id };
}
export async function GET(request: Request, { params }: Params) {
  try {
    const { db, data, userId, notebookId } = await source(request, params);
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
    const path = ownedDocumentPath(userId, notebookId, data);
    if (!path) throw new HttpError(404, "Datei nicht gefunden.");
    const result = checked(
      await documentStorage(db).createSignedUrl(path, 120),
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
    const { db, data, userId, notebookId } = await source(request, params);
    const path = ownedDocumentPath(userId, notebookId, data);
    if (path) await removeDocumentFiles(db, [path]);
    checked(
      await db
        .from("sources")
        .delete()
        .eq("id", data.id)
        .eq("notebook_id", notebookId)
        .eq("user_id", userId),
    );

    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
