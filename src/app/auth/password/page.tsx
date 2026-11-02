import { redirect } from "next/navigation";
import { configured } from "@/lib/config";
import { supabase } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import { PasswordReset } from "@/components/password-reset";
export const dynamic = "force-dynamic";
export default async function PasswordPage() {
  if (!configured()) redirect("/");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/?auth_error=1");
  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <div className="mb-8">
        <Brand />
      </div>
      <PasswordReset />
    </main>
  );
}
