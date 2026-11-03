import { afterEach, describe, it, expect, vi } from "vitest";
import { api, requestApi, notebookUrl, sourceUrl } from "@/lib/client/api";
afterEach(() => vi.unstubAllGlobals());
describe("shared browser API transport", () => {
  it("forwards request cancellation to fetch", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    await requestApi(
      "/api/notebooks/test/chat",
      "POST",
      { question: "Budget?" },
      { signal },
    );
    expect(fetch.mock.calls[0][1].signal).toBe(signal);
  });

  it("encodes JSON while leaving multipart boundaries to the browser", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    await expect(
      api("/api/notebooks", "POST", { title: "Notiz" }),
    ).resolves.toEqual({ ok: true });
    expect(fetch.mock.calls[0][1]).toMatchObject({
      headers: { "Content-Type": "application/json" },
      body: '{"title":"Notiz"}',
    });
    const form = new FormData();
    form.set("file", new Blob(["%PDF-"], { type: "application/pdf" }), "a.pdf");
    await requestApi("/upload", "POST", form);
    expect(fetch.mock.calls[1][1].headers).toBeUndefined();
    expect(fetch.mock.calls[1][1].body).toBe(form);
  });
  it("reports JSON server errors and handles non-JSON platform errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ error: "Zu viele Anfragen." }, { status: 429 }),
        )
        .mockResolvedValueOnce(
          new Response("<html>Gateway error</html>", { status: 502 }),
        ),
    );
    await expect(api("/api")).rejects.toThrow("Zu viele Anfragen.");
    await expect(api("/api")).rejects.toThrow(
      "Anfrage fehlgeschlagen. Bitte erneut versuchen.",
    );
  });
  it("constructs notebook-scoped source URLs with escaped identifiers", () => {
    expect(notebookUrl("notebook", "/chat")).toBe(
      "/api/notebooks/notebook/chat",
    );
    expect(sourceUrl("notebook", "source/other")).toBe(
      "/api/notebooks/notebook/sources/source%2Fother",
    );
  });
});
