import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { retrieve } from "@/lib/rag/retrieval";
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_USER_A_EMAIL",
  "TEST_USER_A_PASSWORD",
  "TEST_USER_B_EMAIL",
  "TEST_USER_B_PASSWORD",
];
const enabled = required.every((key) => Boolean(process.env[key]));
describe.skipIf(!enabled)(
  "live pgvector + RLS isolation (isolated Supabase project)",
  () => {
    it("filters by notebook, selected sources, ready status and user even through direct RPC", async () => {
      const a = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      );
      const b = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      );
      const authA = await a.auth.signInWithPassword({
        email: process.env.TEST_USER_A_EMAIL!,
        password: process.env.TEST_USER_A_PASSWORD!,
      });
      const authB = await b.auth.signInWithPassword({
        email: process.env.TEST_USER_B_EMAIL!,
        password: process.env.TEST_USER_B_PASSWORD!,
      });
      expect(authA.error).toBeNull();
      expect(authB.error).toBeNull();
      expect(authA.data.user!.id).not.toBe(authB.data.user!.id);
      const ids = [
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID(),
      ];
      const sourceIds = Array.from({ length: 5 }, () => crypto.randomUUID());
      const vector = Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));
      try {
        for (const [client, user, id] of [
          [a, authA.data.user!, ids[0]],
          [a, authA.data.user!, ids[1]],
          [b, authB.data.user!, ids[2]],
        ] as const) {
          expect(
            (
              await client
                .from("notebooks")
                .insert({ id, user_id: user.id, title: "Integration fixture" })
            ).error,
          ).toBeNull();
        }
        for (let i = 0; i < 5; i++) {
          const client = i === 4 ? b : a;
          const user = i === 4 ? authB.data.user! : authA.data.user!;
          const notebook = i === 4 ? ids[2] : i === 2 ? ids[1] : ids[0];
          expect(
            (
              await client
                .from("sources")
                .insert({
                  id: sourceIds[i],
                  notebook_id: notebook,
                  user_id: user.id,
                  name: `test-${i}.pdf`,
                  storage_path: `${user.id}/${notebook}/${sourceIds[i]}.pdf`,
                  status: i === 3 ? "processing" : "ready",
                  page_count: 1,
                })
            ).error,
          ).toBeNull();
          expect(
            (
              await client
                .from("document_chunks")
                .insert({
                  notebook_id: notebook,
                  source_id: sourceIds[i],
                  user_id: user.id,
                  page_number: 1,
                  chunk_index: 0,
                  content: `Sentinel ${i}`,
                  embedding: vector,
                })
            ).error,
          ).toBeNull();
        }
        const matches = await retrieve(a, ids[0], [sourceIds[0]], vector);
        expect(matches.map((m) => m.content)).toEqual(["Sentinel 0"]);
        expect(await retrieve(a, ids[0], [sourceIds[1]], vector)).toHaveLength(
          1,
        );
        expect(
          await retrieve(
            a,
            ids[0],
            [sourceIds[2], sourceIds[3], sourceIds[4]],
            vector,
          ),
        ).toEqual([]);
        expect(await retrieve(a, ids[2], [sourceIds[4]], vector)).toEqual([]);
        expect(await retrieve(b, ids[0], [sourceIds[0]], vector)).toEqual([]);
        expect(await retrieve(a, ids[0], [], vector)).toEqual([]);
        const stolen = await b
          .from("document_chunks")
          .select("id")
          .eq("notebook_id", ids[0]);
        expect(stolen.data).toEqual([]);
        const forged = await b
          .from("sources")
          .insert({
            notebook_id: ids[0],
            user_id: authB.data.user!.id,
            name: "forged.pdf",
            storage_path: "forged",
          });
        expect(forged.error).not.toBeNull();
      } finally {
        await a.from("notebooks").delete().in("id", ids.slice(0, 2));
        await b.from("notebooks").delete().eq("id", ids[2]);
        await a.auth.signOut();
        await b.auth.signOut();
      }
    });
  },
);
