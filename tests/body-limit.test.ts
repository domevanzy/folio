import { describe, it, expect } from "vitest";
import { readLimited, readJson } from "@/lib/http";
describe("bounded request parsing", () => {
  it("enforces the real byte limit without a Content-Length header", async () => {
    const request = new Request("https://folio.test", {
      method: "POST",
      body: "abcdef",
    });
    await expect(readLimited(request, 5)).rejects.toMatchObject({
      status: 413,
    });
  });
  it("counts UTF-8 bytes and parses valid JSON", async () => {
    await expect(
      readLimited(
        new Request("https://folio.test", { method: "POST", body: "äöü" }),
        5,
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      readJson(
        new Request("https://folio.test", {
          method: "POST",
          body: '{"question":"Text"}',
        }),
      ),
    ).resolves.toEqual({ question: "Text" });
  });
});
