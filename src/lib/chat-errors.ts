/** Return actionable messages without exposing provider payloads, prompts or credentials. */
export function chatFailure(error: unknown): {
  status: number;
  message: string;
} {
  let current: unknown = error;
  for (let i = 0; i < 4 && current && typeof current === "object"; i++) {
    const value = current as {
      statusCode?: number;
      name?: string;
      lastError?: unknown;
      cause?: unknown;
    };
    if (value.statusCode === 503 || value.statusCode === 502)
      return {
        status: 503,
        message:
          "Gemini ist momentan ausgelastet oder nicht erreichbar. Bitte versuche es später erneut.",
      };
    if (value.statusCode === 429)
      return {
        status: 429,
        message:
          "Das Gemini-Anfragelimit ist erreicht. Bitte später erneut versuchen oder die API-Quote prüfen.",
      };
    if (value.statusCode === 401 || value.statusCode === 403)
      return {
        status: 503,
        message:
          "Gemini hat den API-Zugriff abgelehnt. Bitte API-Key und Modellberechtigung prüfen.",
      };
    if (value.statusCode === 404)
      return {
        status: 503,
        message:
          "Das konfigurierte Gemini-Modell ist für diesen API-Zugang nicht verfügbar.",
      };
    if (
      value.name &&
      (/timeout/i.test(value.name) || value.name === "AbortError")
    )
      return {
        status: 504,
        message:
          "Die Antwort hat zu lange gedauert oder wurde abgebrochen. Bitte erneut versuchen.",
      };
    current = value.lastError ?? value.cause;
  }
  return {
    status: 502,
    message:
      "Die Antwort konnte nicht abgeschlossen werden. Bitte erneut versuchen.",
  };
}
