import { readFile } from "node:fs/promises";
import pg from "pg";

const { VERCEL, VERCEL_ENV, VERCEL_GIT_COMMIT_REF } = process.env;

async function checkStagingSchema() {
  if (VERCEL !== "1" || VERCEL_ENV === "production") return;
  if (!VERCEL_ENV || (VERCEL_ENV === "preview" && !VERCEL_GIT_COMMIT_REF)) {
    throw new Error("Vercel-Systemvariablen für Umgebung und Git-Branch aktivieren.");
  }
  if (VERCEL_ENV !== "preview" || VERCEL_GIT_COMMIT_REF !== "staging") return;

  const connection = process.env.STAGING_SCHEMA_DATABASE_URL;
  if (!connection) {
    throw new Error("STAGING_SCHEMA_DATABASE_URL als Secret für Preview → staging setzen.");
  }

  let database;
  let project;
  try {
    database = new URL(connection);
    project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  } catch {
    throw new Error("Staging-Datenbank-URL und Supabase-Projekt-URL prüfen.");
  }

  if (database.protocol !== "postgresql:" ||
      !database.hostname.endsWith(".pooler.supabase.com") ||
      database.username !== `folio_schema_check.${project}`) {
    throw new Error("Session-Pooler und folio_schema_check für dasselbe Staging-Projekt verwenden.");
  }

  const sql = await readFile(new URL("./check-staging-schema.sql", import.meta.url), "utf8");
  const client = new pg.Client({
    host: database.hostname,
    port: 5432,
    database: "postgres",
    user: database.username,
    password: decodeURIComponent(database.password),
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
    query_timeout: 10_000,
  });

  let rows;
  try {
    await client.connect();
    await client.query("begin read only");
    ({ rows } = await client.query(sql));
  } catch (error) {
    const code = /^[A-Z0-9_]+$/.test(error.code ?? "") ? ` (${error.code})` : "";
    throw new Error(`Datenbankprüfung fehlgeschlagen${code}. Zugang und Leserechte prüfen.`);
  } finally {
    await client.end();
  }

  const missing = rows.filter(({ ok }) => !ok).map(({ name }) => name);
  if (missing.length) {
    throw new Error(`Schema aus 001_folio.sql fehlt oder weicht ab: ${missing.join(", ")}.`);
  }
  console.log("Supabase Staging: Schema und RPC-Berechtigungen geprüft.");
}

try {
  await checkStagingSchema();
} catch (error) {
  console.error(`Supabase Staging: ${error.message}`);
  process.exitCode = 1;
}
