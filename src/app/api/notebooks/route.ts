import { notebookTitleSchema } from "@/lib/validation";
import { context, failure, rateLimit, checked, readJson } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const { db, user } = await context(request);
    await rateLimit(db, "notebook");
    const { title } = notebookTitleSchema.parse(await readJson(request));
    const { data } = checked(
      await db
        .from("notebooks")
        .insert({ title, user_id: user.id })
        .select()
        .single(),
    );
    return Response.json(data, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
