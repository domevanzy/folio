/** Shared browser transport: JSON and multipart use the same error handling. */
export async function requestApi(
  url: string,
  method = "GET",
  body?: unknown,
  options?: { signal?: AbortSignal },
): Promise<Response> {
  const multipart = body instanceof FormData;
  const response = await fetch(url, {
    method,
    signal: options?.signal,
    headers:
      body !== undefined && !multipart
        ? { "Content-Type": "application/json" }
        : undefined,
    body:
      body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  });
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null);
    const message =
      error &&
      typeof error === "object" &&
      "error" in error &&
      typeof error.error === "string"
        ? error.error
        : "Anfrage fehlgeschlagen. Bitte erneut versuchen.";
    throw new Error(message);
  }
  return response;
}
export async function api<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  return (await requestApi(url, method, body)).json() as Promise<T>;
}
export function notebookUrl(notebookId: string, suffix = "") {
  return `/api/notebooks/${encodeURIComponent(notebookId)}${suffix}`;
}
export function sourceUrl(notebookId: string, sourceId: string) {
  return notebookUrl(notebookId, `/sources/${encodeURIComponent(sourceId)}`);
}
