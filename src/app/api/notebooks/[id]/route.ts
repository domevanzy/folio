import { removeDocumentFiles } from "@/lib/storage";
import { notebookTitleSchema } from "@/lib/validation";
import { notebookContext, failure, checked, readJson } from "@/lib/http";
type Params = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { db } = await notebookContext(id, request);
    const { title } = notebookTitleSchema.parse(await readJson(request));
    checked(await db.from("notebooks").update({ title }).eq("id", id));
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { db } = await notebookContext(id, request);
    const { data } = checked(
      await db.from("sources").select("storage_path").eq("notebook_id", id),
    );
    await removeDocumentFiles(
      db,
      (data || []).map((s) => s.storage_path),
    );
    checked(await db.from("notebooks").delete().eq("id", id));
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
