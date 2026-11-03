import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, DELETE } from "@/app/api/notebooks/[id]/sources/[sourceId]/route";
import { DELETE as deleteNotebook } from "@/app/api/notebooks/[id]/route";

const { supabase } = vi.hoisted(() => ({ supabase: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ supabase }));
vi.mock("@/lib/config", () => ({ configured: () => true }));

const owner = crypto.randomUUID();
const other = crypto.randomUUID();
const notebook = crypto.randomUUID();
const anotherNotebook = crypto.randomUUID();
const source = crypto.randomUUID();
const canonicalPath = `${owner}/${notebook}/${source}.pdf`;
const foreignPath = `${owner}/${anotherNotebook}/${crypto.randomUUID()}.pdf`;
const signedUrl = vi.fn();
const remove = vi.fn();
const removedRows = vi.fn();
const sourceRow = {
  id: source,
  user_id: owner,
  notebook_id: notebook,
  kind: "pdf",
  storage_path: canonicalPath,
};
type Row = Record<string, string>;

function database(user: string | null, sources: Row[] = [sourceRow]) {
  const tables: Record<string, Row[]> = {
    notebooks: [{ id: notebook, user_id: owner }],
    sources,
  };

  // This fake deliberately applies no RLS, so only handler filters protect rows.
  supabase.mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: user ? { id: user } : null } }),
    },
    storage: { from: () => ({ createSignedUrl: signedUrl, remove }) },
    from(table: string) {
      let rows = tables[table];
      let deleting = false;
      const query = {
        select: () => query,
        delete() {
          deleting = true;
          return query;
        },
        eq(column: string, value: string) {
          rows = rows.filter((row) => row[column] === value);
          return query;
        },
        single: async () => ({ data: rows[0] ?? null, error: null }),
        then(resolve: (result: { data: Row[]; error: null }) => void) {
          if (deleting) removedRows(table, rows);
          resolve({ data: rows, error: null });
        },
      };
      return query;
    },
  });
}

const origin = "https://folio.example";
const request = (method: string) =>
  new Request(`${origin}/api/notebooks/${notebook}/sources/${source}`, {
    method,
    headers: { origin },
  });
const params = { params: Promise.resolve({ id: notebook, sourceId: source }) };

beforeEach(() => {
  vi.clearAllMocks();
  signedUrl.mockResolvedValue({
    data: { signedUrl: "signed-url" },
    error: null,
  });
  remove.mockResolvedValue({ error: null });
});

describe("API authorization without RLS", () => {
  it("requires a verified session and hides foreign notebooks", async () => {
    database(null);
    expect((await GET(request("GET"), params)).status).toBe(401);
    database(other);
    expect((await GET(request("GET"), params)).status).toBe(404);
    expect((await DELETE(request("DELETE"), params)).status).toBe(404);
    expect(signedUrl).not.toHaveBeenCalled();
    expect(removedRows).not.toHaveBeenCalled();
  });

  it("rejects sources from other notebooks and other accounts", async () => {
    database(owner, [{ ...sourceRow, notebook_id: anotherNotebook }]);
    expect((await GET(request("GET"), params)).status).toBe(404);
    database(owner, [{ ...sourceRow, user_id: other }]);
    expect((await DELETE(request("DELETE"), params)).status).toBe(404);
    expect(signedUrl).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(removedRows).not.toHaveBeenCalled();
  });

  it("signs only the authorized source's own PDF", async () => {
    database(owner);
    expect((await GET(request("GET"), params)).status).toBe(200);
    expect(signedUrl).toHaveBeenCalledWith(canonicalPath, 120);
    signedUrl.mockClear();
    database(owner, [{ ...sourceRow, storage_path: foreignPath }]);
    expect((await GET(request("GET"), params)).status).toBe(404);
    expect(signedUrl).not.toHaveBeenCalled();
  });

  it("can delete a malformed source without touching the other notebook's file", async () => {
    const malformed = { ...sourceRow, storage_path: foreignPath };
    database(owner, [malformed]);
    expect((await DELETE(request("DELETE"), params)).status).toBe(200);
    expect(remove).not.toHaveBeenCalled();
    expect(removedRows).toHaveBeenCalledWith("sources", [malformed]);
  });

  it("only removes files belonging to the notebook being deleted", async () => {
    database(owner, [
      sourceRow,
      { ...sourceRow, id: crypto.randomUUID(), storage_path: foreignPath },
    ]);
    expect((await deleteNotebook(request("DELETE"), params)).status).toBe(200);
    expect(remove).toHaveBeenCalledExactlyOnceWith([canonicalPath]);
  });
});
