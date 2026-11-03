"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole } from "lucide-react";
import {
  passwordSchema,
  authErrorMessage,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "@/lib/auth";
import { browserSupabase } from "@/lib/supabase/browser";
import { PasswordField } from "./ui/form-field";
import { Button } from "./ui/button";
export function PasswordReset() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="panel p-7">
      <LockKeyhole size={25} className="mb-5 text-[#596d8c]" />
      <h1 className="text-xl font-semibold">Neues Passwort festlegen</h1>
      <p className="muted mt-2 text-sm leading-relaxed">
        Wähle ein Passwort, mit dem du dich künftig direkt anmelden kannst.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const parsed = passwordSchema.safeParse({ password, confirmation });
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          setBusy(true);
          setError("");
          try {
            const { error } = await browserSupabase().auth.updateUser({
              password: parsed.data.password,
            });
            if (error) {
              setError(authErrorMessage(error));
              return;
            }
            setPassword("");
            setConfirmation("");
            router.replace("/");
            router.refresh();
          } catch {
            setError(
              "Das Passwort konnte nicht gespeichert werden. Bitte erneut versuchen.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <PasswordField
          label="Neues Passwort"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          hint={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
        <PasswordField
          label="Passwort wiederholen"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          disabled={busy}
        />
        {error && (
          <p role="alert" className="text-xs leading-relaxed text-red-700">
            {error}
          </p>
        )}
        <Button disabled={busy} className="w-full">
          {busy && <Loader2 className="spinner" size={16} />}Passwort speichern
        </Button>
      </form>
      <Link href="/" className="muted mt-5 block text-center text-xs underline">
        Zurück zu Folio
      </Link>
    </div>
  );
}
