import { redirect, notFound } from "next/navigation";
import { configured } from "@/lib/config";
import { supabase } from "@/lib/supabase/server";
import { Workspace } from "@/components/workspace";
import { uuid } from "@/lib/http";
export const dynamic = "force-dynamic";
export default async function NotebookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  if (!configured()) redirect("/");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/");
  const { data: notebook } = await db
    .from("notebooks")
    .select("id,title,created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!notebook) notFound();
  const [sources, messages] = await Promise.all([
    db
      .from("sources")
      .select("id,name,status,page_count,error,created_at")
      .eq("notebook_id", id)
      .order("created_at"),
    db
      .from("messages")
      .select("id,role,content,citations")
      .eq("notebook_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (sources.error || messages.error)
    throw new Error("Notebook-Inhalte konnten nicht geladen werden.");
  return (
    <Workspace
      notebook={notebook}
      initialSources={sources.data || []}
      initialMessages={(messages.data || []).reverse()}
    />
  );
}
