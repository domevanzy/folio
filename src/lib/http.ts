import { supabase } from "@/lib/supabase/server";
import { configured } from "@/lib/config";
import { z } from "zod";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const uuid = z.string().uuid();
export async function context(request?: Request) {
  if (request && !["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin)
      throw new HttpError(403, "Ungültiger Anfrageursprung.");
  }
  if (!configured())
    throw new HttpError(503, "Supabase ist noch nicht eingerichtet.");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new HttpError(401, "Bitte melde dich an.");
  return { db, user };
}
export async function notebookContext(id: string, request?: Request) {
  uuid.parse(id);
  const ctx = await context(request);
  const { data, error } = await ctx.db
    .from("notebooks")
    .select("*")
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .single();
  if (error || !data) throw new HttpError(404, "Notebook nicht gefunden.");
  return { ...ctx, notebook: data };
}
export async function rateLimit(
  db: Awaited<ReturnType<typeof supabase>>,
  kind: string,
) {
  const { data, error } = await db.rpc("consume_rate_limit", { p_kind: kind });
  if (error) throw new HttpError(503, "Limit-Prüfung fehlgeschlagen.");
  if (!data)
    throw new HttpError(
      429,
      "Zu viele Anfragen. Bitte später erneut versuchen.",
    );
}
export function failure(error: unknown) {
  if (error instanceof SyntaxError)
    return Response.json({ error: "Ungültige JSON-Eingabe." }, { status: 400 });
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError)
    return Response.json({ error: "Ungültige Eingabe." }, { status: 400 });
  console.error(
    error instanceof Error ? error.message : "Unknown server error",
  );
  return Response.json(
    {
      error:
        "Die Anfrage konnte nicht abgeschlossen werden. Bitte erneut versuchen.",
    },
    { status: 500 },
  );
}
export function checked<T extends { error: unknown }>(result: T): T {
  if (result.error) throw new Error("Datenbankoperation fehlgeschlagen.");
  return result;
}

/** Bound streamed bodies too: Content-Length can be absent or untrustworthy. */
export async function readLimited(request: Request, maxBytes: number) {
  const declared = Number(request.headers.get("content-length"));
  if (declared > maxBytes) throw new HttpError(413, "Die Anfrage ist zu groß.");
  if (!request.body) throw new HttpError(400, "Leere Anfrage.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "Die Anfrage ist zu groß.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
export async function readJson(request: Request): Promise<unknown> {
  return JSON.parse(
    new TextDecoder().decode(await readLimited(request, 20 * 1024)),
  );
}
