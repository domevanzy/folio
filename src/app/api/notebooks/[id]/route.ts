import { ownedDocumentPath, removeDocumentFiles } from "@/lib/storage";
import { notebookTitleSchema } from "@/lib/validation";
import { notebookContext, failure, checked, readJson } from "@/lib/http";
type Params = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { db, user, notebook } = await notebookContext(id, request);
    const { title } = notebookTitleSchema.parse(await readJson(request));
    checked(
      await db
        .from("notebooks")
        .update({ title })
        .eq("id", notebook.id)
        .eq("user_id", user.id),
    );
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { db, user, notebook } = await notebookContext(id, request);
    const { data } = checked(
      await db
        .from("sources")
        .select("id,storage_path")
        .eq("notebook_id", notebook.id)
        .eq("user_id", user.id),
    );
    await removeDocumentFiles(
      db,
      (data || []).flatMap((source) => {
        const path = ownedDocumentPath(user.id, notebook.id, source);
        return path ? [path] : [];
      }),
    );
    checked(
      await db
        .from("notebooks")
        .delete()
        .eq("id", notebook.id)
        .eq("user_id", user.id),
    );
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
