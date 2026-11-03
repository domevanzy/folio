import type { Notebook } from "@/lib/types";
import { configured } from "@/lib/config";
import { supabase } from "@/lib/supabase/server";
import { Dashboard } from "@/components/dashboard";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  const enabled = configured();
  let email: string | undefined;
  let notebooks: Notebook[] = [];
  let loadError = false;
  if (enabled) {
    const db = await supabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    email = user?.email;
    if (user) {
      const result = await db
        .from("notebooks")
        .select("id,title,created_at")
        .order("created_at", { ascending: false });
      notebooks = result.data || [];
      loadError = Boolean(result.error);
    }
  }
  return (
    <Dashboard
      notebooks={notebooks}
      email={email}
      enabled={enabled}
      loadError={loadError}
      authError={Boolean((await searchParams).auth_error)}
    />
  );
}
