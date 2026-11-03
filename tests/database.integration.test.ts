import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";

// Real PostgreSQL + pgvector. Only the Supabase-owned auth/storage scaffolding is supplied here.
const db = new PGlite({ extensions: { vector } });
const owner = crypto.randomUUID();
const other = crypto.randomUUID();
const notebooks = Array.from({ length: 3 }, () => crypto.randomUUID());
const sources = Array.from({ length: 5 }, () => crypto.randomUUID());
const embedding = JSON.stringify(
  Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0)),
);
async function actAs(user: string) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
}
async function search(notebook: string, ids: string[]) {
  return (
    await db.query<{ source_id: string; content: string }>(
      `select * from public.match_document_chunks($1::uuid,$2::uuid[],$3::extensions.vector,10,0.3)`,
      [notebook, ids, embedding],
    )
  ).rows;
}
beforeAll(async () => {
  await db.exec(`
 create role anon; create role authenticated;
 create schema extensions; create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
 grant usage on schema public,auth,storage,extensions to authenticated,anon;
 grant select,insert,delete on storage.objects to authenticated;
 `);
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/001_folio.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.query("insert into auth.users values($1),($2)", [owner, other]);
  for (let i = 0; i < 3; i++)
    await db.query(
      "insert into public.notebooks(id,user_id,title) values($1,$2,$3)",
      [notebooks[i], i === 2 ? other : owner, `Notebook ${i}`],
    );
  for (let i = 0; i < 5; i++) {
    const user = i === 4 ? other : owner;
    const notebook = notebooks[i === 4 ? 2 : i === 2 ? 1 : 0];
    await db.query(
      "insert into public.sources(id,notebook_id,user_id,name,storage_path,status,page_count) values($1,$2,$3,$4,$5,$6,1)",
      [
        sources[i],
        notebook,
        user,
        `doc${i}.pdf`,
        `${user}/${notebook}/${sources[i]}.pdf`,
        i === 3 ? "processing" : "ready",
      ],
    );
    await db.query(
      "insert into public.document_chunks(notebook_id,source_id,user_id,page_number,chunk_index,content,embedding) values($1,$2,$3,1,0,$4,$5::extensions.vector)",
      [notebook, sources[i], user, `Evidence ${i}`, embedding],
    );
  }
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("migrated PostgreSQL/pgvector and RLS", () => {
  it("applies exact notebook/source filters and excludes unfinished sources", async () => {
    await actAs(owner);
    expect(
      (await search(notebooks[0], [sources[0]])).map((r) => r.content),
    ).toEqual(["Evidence 0"]);
    expect(
      (await search(notebooks[0], [sources[1]])).map((r) => r.content),
    ).toEqual(["Evidence 1"]);
    expect(await search(notebooks[0], [sources[2], sources[3]])).toEqual([]);
    expect(await search(notebooks[0], [])).toEqual([]);
  });
  it("rejects cross-user retrieval and direct reads", async () => {
    await actAs(other);
    expect(await search(notebooks[0], [sources[0]])).toEqual([]);
    expect(
      (
        await db.query("select id from public.notebooks where id=$1", [
          notebooks[0],
        ])
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          "select id from public.document_chunks where source_id=$1",
          [sources[0]],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (await search(notebooks[2], [sources[4]])).map((r) => r.content),
    ).toEqual(["Evidence 4"]);
  });
  it("blocks foreign owners and cross-notebook foreign keys", async () => {
    await actAs(other);
    await expect(
      db.query("insert into public.notebooks(user_id,title) values($1,$2)", [
        owner,
        "Forged",
      ]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.sources(notebook_id,user_id,name,storage_path) values($1,$2,$3,$4)",
        [notebooks[0], other, "forged.pdf", "forged"],
      ),
    ).rejects.toThrow();
  });
  it("enforces atomic per-user limits and hides counter writes", async () => {
    await actAs(owner);
    for (let i = 0; i < 8; i++)
      expect(
        (
          await db.query<{ allowed: boolean }>(
            "select public.consume_rate_limit('upload') allowed",
          )
        ).rows[0].allowed,
      ).toBe(true);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.consume_rate_limit('upload') allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.consume_rate_limit('unknown') allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    await expect(
      db.query("delete from public.request_limits"),
    ).rejects.toThrow();
    await actAs(other);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.consume_rate_limit('upload') allowed",
        )
      ).rows[0].allowed,
    ).toBe(true);
  });
  it("protects private storage paths and anonymous function access", async () => {
    await actAs(owner);
    await db.query(
      "insert into storage.objects(bucket_id,name) values($1,$2)",
      ["documents", `${owner}/${notebooks[0]}/${sources[0]}.pdf`],
    );
    await expect(
      db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
        "documents",
        `${other}/${notebooks[2]}/${sources[4]}.pdf`,
      ]),
    ).rejects.toThrow();
    await actAs(other);
    expect((await db.query("select * from storage.objects")).rows).toEqual([]);
    await db.exec("reset role;set role anon;");
    await expect(
      db.query("select public.consume_rate_limit('chat')"),
    ).rejects.toThrow();
    await expect(search(notebooks[0], [sources[0]])).rejects.toThrow();
  });
});

it("checks staging schema as the build role and reports a missing RPC", async () => {
  const sql = await readFile(
    new URL("../scripts/check-staging-schema.sql", import.meta.url),
    "utf8",
  );
  await db.exec(`
    reset role;
    create role folio_schema_check;
    grant usage on schema extensions, storage to folio_schema_check;
    grant select (id, public, file_size_limit, allowed_mime_types)
      on storage.buckets to folio_schema_check;
  `);

  async function check() {
    await db.exec("set role folio_schema_check; begin read only");
    try {
      return (await db.query<{ name: string; ok: boolean }>(sql)).rows;
    } finally {
      await db.exec("rollback; reset role");
    }
  }

  expect((await check()).filter(({ ok }) => !ok)).toEqual([]);
  await db.exec("begin; drop function public.consume_rate_limit(text)");
  try {
    const result = await db.query<{ name: string; ok: boolean }>(sql);
    expect(result.rows.filter(({ ok }) => !ok)).toEqual([
      { name: "public.consume_rate_limit(text)", ok: false },
    ]);
  } finally {
    await db.exec("rollback");
  }
});
