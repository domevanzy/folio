import { browserSupabase } from "@/lib/supabase/browser";
import {
  authErrorMessage,
  emailSchema,
  loginSchema,
  registrationSchema,
  type AuthMode,
} from "@/lib/auth";
export async function submitAuth(
  mode: AuthMode,
  input: { email: string; password: string; confirmation: string },
  origin: string,
) {
  const db = browserSupabase();
  if (mode === "recover") {
    const email = emailSchema.parse(input.email);
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: origin + "/auth/confirm?flow=recovery",
    });
    if (error) throw new Error(authErrorMessage(error));
    return {
      signedIn: false,
      message:
        "Falls für diese Adresse ein Konto besteht, erhältst du eine E-Mail zum Festlegen eines neuen Passworts. Prüfe auch deinen Spamordner.",
    };
  }
  const credentials = (
    mode === "register" ? registrationSchema : loginSchema
  ).parse(input);
  if (mode === "login") {
    const { error } = await db.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    if (error) throw new Error(authErrorMessage(error));
    return { signedIn: true, message: "" };
  }
  const { data, error } = await db.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: { emailRedirectTo: origin + "/auth/confirm?flow=signup" },
  });
  if (error) throw new Error(authErrorMessage(error));
  return {
    signedIn: Boolean(data.session),
    message:
      "Prüfe dein Postfach und bestätige einmalig deine E-Mail-Adresse. Danach meldest du dich hier mit deinem Passwort an. Falls du schon ein Konto hast, nutze Anmelden oder Passwort vergessen.",
  };
}
