import { readFile } from "node:fs/promises";
import pg from "pg";

async function checkReleaseSchema() {
  const connection = process.env.RELEASE_DB_MIGRATION_URL;
  if (!connection) {
    throw new Error("RELEASE_DB_MIGRATION_URL als GitHub Actions Secret setzen.");
  }

  let database;
  let project;
  try {
    database = new URL(connection);
    project = process.env.RELEASE_SUPABASE_PROJECT_REF;
  } catch {
    throw new Error("Datenbank-URL und Supabase-Projekt-URL prüfen.");
  }

  if (!["postgresql:", "postgres:"].includes(database.protocol)) {
    throw new Error("RELEASE_DB_MIGRATION_URL braucht postgresql:// oder postgres://.");
  }
  if (!database.hostname.endsWith(".pooler.supabase.com") ||
      (database.port && database.port !== "5432")) {
    throw new Error("RELEASE_DB_MIGRATION_URL braucht den Supabase Session-Pooler auf Port 5432.");
  }
  const username = decodeURIComponent(database.username);
  if (!username.startsWith("postgres.")) {
    throw new Error("Der Pooler-Benutzer muss postgres.<projekt-ref> sein.");
  }
  if (username !== `postgres.${project}`) {
    throw new Error("Die Projekt-Ref im Pooler-Benutzernamen stimmt nicht mit RELEASE_SUPABASE_PROJECT_REF überein.");
  }

  const sql = await readFile(new URL("./check-staging-schema.sql", import.meta.url), "utf8");
  const ca = process.env.RELEASE_SCHEMA_DATABASE_CA?.trim();
  const client = new pg.Client({
    host: database.hostname,
    port: 5432,
    database: "postgres",
    user: username,
    password: decodeURIComponent(database.password),
    ssl: { rejectUnauthorized: true, ca },
    connectionTimeoutMillis: 10_000,
    query_timeout: 10_000,
  });

  let rows;
  try {
    await client.connect();
    await client.query("begin read only");
    ({ rows } = await client.query(sql));
  } catch (error) {
    if (error.code === "SELF_SIGNED_CERT_IN_CHAIN" && !ca) {
      throw new Error("Supabase-CA-Zertifikat als RELEASE_SCHEMA_DATABASE_CA für die Release-Umgebung setzen.");
    }
    const code = /^[A-Z0-9_]+$/.test(error.code ?? "") ? ` (${error.code})` : "";
    throw new Error(`Datenbankprüfung fehlgeschlagen${code}. Zugang und Leserechte prüfen.`);
  } finally {
    await client.end();
  }

  const missing = rows.filter(({ ok }) => !ok).map(({ name }) => name);
  if (missing.length) {
    throw new Error(`Schema aus 001_folio.sql fehlt oder weicht ab: ${missing.join(", ")}.`);
  }
  console.log("Supabase Release: Schema und RPC-Berechtigungen geprüft.");
}

try {
  await checkReleaseSchema();
} catch (error) {
  console.error(`Supabase Release: ${error instanceof URIError ? "URL-Kodierung von Benutzer oder Passwort prüfen." : error.message}`);
  process.exitCode = 1;
}
