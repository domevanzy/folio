import { z } from "zod";
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const emailSchema = z
  .string()
  .trim()
  .email("Bitte eine gültige E-Mail-Adresse eingeben.")
  .max(254);
export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "Bitte dein Passwort eingeben.")
    .max(PASSWORD_MAX_LENGTH),
});
export const passwordSchema = z
  .object({
    password: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `Bitte mindestens ${PASSWORD_MIN_LENGTH} Zeichen verwenden.`,
      )
      .max(PASSWORD_MAX_LENGTH, "Bitte maximal 128 Zeichen verwenden."),
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "Die Passwörter stimmen nicht überein.",
    path: ["confirmation"],
  });
export const registrationSchema = passwordSchema.safeExtend({
  email: emailSchema,
});
export type AuthMode = "login" | "register" | "recover";
export function authErrorMessage(error: { code?: string; status?: number }) {
  // Provider codes identify the actual limit; a 429 status alone does not.
  if (error.code === "over_email_send_rate_limit")
    return "Das Versandlimit für E-Mails ist erreicht. Eine neue Passwort- oder Bestätigungs-E-Mail kann momentan nicht gesendet werden. Bitte später erneut versuchen. Mit einem vorhandenen Passwort kannst du dich weiterhin anmelden.";
  if (error.status === 429)
    return "Zu viele Anfragen. Bitte warten und später erneut versuchen.";
  switch (error.code) {
    case "invalid_credentials":
      return "E-Mail-Adresse oder Passwort ist nicht korrekt.";
    case "email_not_confirmed":
      return "Bitte bestätige deine E-Mail-Adresse aus der Registrierung, bevor du dich anmeldest.";
    case "weak_password":
      return "Das Passwort erfüllt die Sicherheitsanforderungen nicht. Bitte ein stärkeres Passwort wählen.";
    case "same_password":
      return "Bitte ein anderes als dein bisheriges Passwort wählen.";
    case "over_request_rate_limit":
      return "Zu viele Anfragen. Bitte warten und später erneut versuchen.";
    case "signup_disabled":
      return "Die Registrierung ist momentan deaktiviert.";
    default:
      return "Die Anmeldung konnte nicht abgeschlossen werden. Bitte Eingaben und Verbindung prüfen.";
  }
}
/** Fixed destinations only; never accept arbitrary return URLs from an auth link. */
export function authDestination(params: URLSearchParams) {
  return params.get("type") === "recovery" || params.get("flow") === "recovery"
    ? "/auth/password"
    : "/";
}
export function authTokenType(value: string | null) {
  return value === "signup" || value === "email" || value === "recovery"
    ? value
    : null;
}
