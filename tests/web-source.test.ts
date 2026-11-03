import { describe, expect, it, vi } from "vitest";
import { extractWebText, importWebSource } from "@/lib/rag/web-source";
import { writtenSourceSchema } from "@/lib/validation";

vi.mock("node:dns/promises", () => ({
  Resolver: class {
    resolve4() {
      return Promise.resolve(["169.254.169.254"]);
    }
  },
}));

describe("written sources", () => {
  it("rejects blank pasted text and URLs with credentials or non-web schemes", () => {
    expect(
      writtenSourceSchema.safeParse({
        kind: "text",
        name: "Notiz",
        content: " ",
      }).success,
    ).toBe(false);
    for (const url of [
      "file:///etc/passwd",
      "https://user:pass@example.org",
      "http://example.org:8080",
    ]) {
      expect(writtenSourceSchema.safeParse({ kind: "web", url }).success).toBe(
        false,
      );
    }
  });

  it("extracts the title and paragraphs without scripts or navigation", () => {
    expect(
      extractWebText(
        "<head><title>Solar &amp; Wind</title></head><body><nav>Menü</nav><p>Erster Absatz.</p><script>private()</script><p>Zweiter Absatz.</p></body>",
      ),
    ).toEqual({
      title: "Solar & Wind",
      content: "Erster Absatz.\n\nZweiter Absatz.",
    });
  });

  it("blocks internal IPs even when a public-looking hostname resolves to one", async () => {
    for (const url of [
      "http://127.1",
      "http://[::1]",
      "http://public.example",
    ]) {
      await expect(importWebSource(url)).rejects.toThrow(
        "Nur öffentliche Webseiten",
      );
    }
  });
});
