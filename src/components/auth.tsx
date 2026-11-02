"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ZodError } from "zod";
import { ArrowRight, LockKeyhole, Loader2 } from "lucide-react";
import { browserSupabase } from "@/lib/supabase/browser";
import { submitAuth } from "@/lib/client/auth";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  type AuthMode,
} from "@/lib/auth";
import { Button } from "./ui/button";
import { FormField, PasswordField } from "./ui/form-field";
const copy = {
  login: {
    title: "Dein Wissen. Dein Raum.",
    description: "Melde dich mit deiner E-Mail-Adresse und deinem Passwort an.",
    button: "Anmelden",
  },
  register: {
    title: "Dein Wissensraum beginnt hier.",
    description:
      "Erstelle ein privates Konto für deine Dokumente und Notebooks.",
    button: "Konto erstellen",
  },
  recover: {
    title: "Zurück in deinen Wissensraum.",
    description:
      "Lass dir eine E-Mail zum Festlegen eines neuen Passworts senden.",
    button: "Passwort zurücksetzen",
  },
};
export function Auth({
  enabled,
  initialError = false,
}: {
  enabled: boolean;
  initialError?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState(
    initialError
      ? "Der bisherige Anmeldelink ist ungültig oder abgelaufen. Melde dich mit deinem Passwort an. Noch kein Passwort? Nutze „Passwort vergessen“."
      : "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function changeMode(next: AuthMode) {
    setMode(next);
    setPassword("");
    setConfirmation("");
    setMessage("");
    setError("");
  }
  return (
    <div className="panel p-7">
      <span className="mb-5 flex size-11 items-center justify-center rounded-xl bg-[#edf2e7]">
        <LockKeyhole size={21} />
      </span>
      <h2 className="text-xl font-semibold">{copy[mode].title}</h2>
      <p className="muted mt-2 leading-relaxed">{copy[mode].description}</p>
      {mode !== "recover" && (
        <div
          className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-[#f1f4ec] p-1"
          aria-label="Zugang wählen"
        >
          {(["login", "register"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant={mode === value ? "outline" : "ghost"}
              size="sm"
              disabled={busy}
              aria-pressed={mode === value}
              onClick={() => changeMode(value)}
            >
              {value === "login" ? "Anmelden" : "Registrieren"}
            </Button>
          ))}
        </div>
      )}
      <form
        className="mt-5 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !enabled) return;
          setBusy(true);
          setError("");
          setMessage("");
          try {
            const result = await submitAuth(
              mode,
              { email, password, confirmation },
              location.origin,
            );
            setMessage(result.message);
            if (result.signedIn) {
              setPassword("");
              setConfirmation("");
              router.replace("/");
              router.refresh();
            }
          } catch (e) {
            setError(
              e instanceof ZodError
                ? e.issues[0]?.message || "Bitte Eingaben prüfen."
                : e instanceof Error
                  ? e.message
                  : "Die Anfrage ist fehlgeschlagen. Bitte erneut versuchen.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <FormField
          label="E-Mail-Adresse"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="du@beispiel.de"
          disabled={!enabled || busy}
        />
        {mode !== "recover" && (
          <PasswordField
            key={mode}
            label="Passwort"
            name="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            minLength={mode === "register" ? PASSWORD_MIN_LENGTH : undefined}
            maxLength={PASSWORD_MAX_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!enabled || busy}
            hint={
              mode === "register"
                ? `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen. Verwende ein eigenes, sicheres Passwort.`
                : undefined
            }
          />
        )}
        {mode === "register" && (
          <PasswordField
            label="Passwort wiederholen"
            name="confirmation"
            autoComplete="new-password"
            required
            value={confirmation}
            maxLength={PASSWORD_MAX_LENGTH}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={!enabled || busy}
          />
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-800"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="rounded-xl bg-[#edf3e6] p-3 text-xs leading-relaxed"
          >
            {message}
          </p>
        )}
        <Button className="w-full" disabled={!enabled || busy}>
          {busy ? (
            <Loader2 className="spinner" size={16} />
          ) : (
            <>
              {copy[mode].button}
              <ArrowRight size={16} />
            </>
          )}
        </Button>
      </form>
      <Button
        type="button"
        variant="ghost"
        className="mt-3 w-full text-xs"
        disabled={busy || !enabled}
        onClick={() => changeMode(mode === "recover" ? "login" : "recover")}
      >
        {mode === "recover"
          ? "Zurück zur Anmeldung"
          : "Passwort vergessen oder noch kein Passwort?"}
      </Button>
      {!enabled && (
        <p className="mt-4 rounded-xl bg-[#f6f1df] p-3 text-xs leading-relaxed">
          Die Anwendung ist noch nicht verbunden. Bitte zuerst Supabase gemäß
          README einrichten.
        </p>
      )}
      <p className="muted mt-4 text-xs">
        Deine Notebooks bleiben privat. Passwörter verwaltet Supabase sicher.
      </p>
    </div>
  );
}
export function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const { error } = await browserSupabase().auth.signOut();
            if (error) throw error;
            router.replace("/");
            router.refresh();
          } catch {
            setError("Abmelden fehlgeschlagen. Bitte erneut versuchen.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Wird abgemeldet …" : "Abmelden"}
      </Button>
      {error && (
        <p role="alert" className="max-w-48 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
