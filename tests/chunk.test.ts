import { describe, it, expect } from "vitest";
import { chunkPages } from "@/lib/rag/chunk";
describe("page-aware semantic chunking", () => {
  it("preserves page numbers, including blank pages and global indices", () => {
    const chunks = chunkPages([
      "Erste Seite.\nNoch ein Absatz.",
      "",
      "Dritte Seite.",
    ]);
    expect(chunks.map((c) => c.page_number)).toEqual([1, 3]);
    expect(chunks.map((c) => c.chunk_index)).toEqual([0, 1]);
  });
  it("keeps short sentences together and overlaps on boundaries", () => {
    const sentence = "Ein kurzer Satz mit einigen Wörtern. ";
    const chunks = chunkPages([sentence.repeat(40)], 200, 40);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((c) => c.content.length <= 200)).toBe(true);
    expect(
      chunks[1].content.slice(0, 45).includes(chunks[0].content.slice(-30)),
    ).toBe(true);
  });
  it("never drops text from an oversized unbroken token", () => {
    const text = "a".repeat(390) + "END";
    const chunks = chunkPages([text], 150, 20);
    expect(
      chunks.map((c, i) => (i ? c.content.slice(20) : c.content)).join(""),
    ).toBe(text);
    expect(chunks.at(-1)?.content.endsWith("END")).toBe(true);
  });
  it("never mixes content between pages", () => {
    const chunks = chunkPages(
      ["alpha ".repeat(90), "beta ".repeat(90)],
      200,
      40,
    );
    expect(
      chunks
        .filter((c) => c.page_number === 1)
        .every((c) => !c.content.includes("beta")),
    ).toBe(true);
    expect(
      chunks
        .filter((c) => c.page_number === 2)
        .every((c) => !c.content.includes("alpha")),
    ).toBe(true);
  });
  it("ignores empty pages and rejects invalid configuration", () => {
    expect(chunkPages(["", "  "])).toEqual([]);
    expect(() => chunkPages(["text"], 100, 100)).toThrow();
  });
});
