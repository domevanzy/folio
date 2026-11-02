import { beforeEach, describe, it, expect, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
const state = vi.hoisted(() => ({ model: undefined as unknown }));
vi.mock("@/lib/rag/model", () => ({ google: () => () => state.model }));
vi.mock("@/lib/config", async (original) => {
  const actual = await original<typeof import("@/lib/config")>();
  return {
    ...actual,
    config: {
      ...actual.config,
      firstChunkTimeoutMs: 40,
      chunkTimeoutMs: 40,
      generationTimeoutMs: 250,
    },
  };
});
import { generateGroundedAnswer } from "@/lib/rag/generate";
import { chatFailure } from "@/lib/chat-errors";
const finish: LanguageModelV4StreamPart = {
  type: "finish",
  finishReason: { unified: "stop", raw: undefined },
  usage: {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 10, text: 10, reasoning: 0 },
  },
};
function modelWith(events: LanguageModelV4StreamPart[]) {
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream<LanguageModelV4StreamPart>({
        start(c) {
          for (const event of events) c.enqueue(event);
          c.close();
        },
      }),
    }),
  });
  state.model = model;
  return model;
}
function options(signal = new AbortController().signal) {
  return {
    question: "Wie hoch ist das Budget?",
    context: "Budget: 180.000 Euro",
    history: [],
    citations: [
      {
        id: "C1",
        sourceId: "source",
        name: "Projektbrief.pdf",
        page: 1,
        excerpt: "Budget: 180.000 Euro",
      },
    ],
    signal,
    onText: vi.fn(),
    onStatus: vi.fn(),
  };
}
beforeEach(() => {
  state.model = undefined;
});
describe("real AI SDK stream handling with test provider", () => {
  it("streams validated paragraphs and returns content only on success", async () => {
    modelWith([
      { type: "text-start", id: "answer" },
      { type: "text-delta", id: "answer", delta: "Das Budget beträgt " },
      { type: "text-delta", id: "answer", delta: "180.000 Euro [C1].\n\n" },
      { type: "text-end", id: "answer" },
      finish,
    ]);
    const request = options();
    expect(await generateGroundedAnswer(request)).toBe(
      "Das Budget beträgt 180.000 Euro [C1].\n\n",
    );
    expect(request.onText).toHaveBeenCalledWith(
      "Das Budget beträgt 180.000 Euro [C1].\n\n",
    );
    expect(request.onStatus.mock.calls.map((c) => c[0])).toEqual([
      "generating",
      "validating",
    ]);
  });
  it("propagates a provider 503 rather than silently returning an empty answer", async () => {
    const error = Object.assign(new Error("provider payload"), {
      statusCode: 503,
    });
    const model = modelWith([{ type: "error", error }]);
    const request = options();
    await expect(generateGroundedAnswer(request)).rejects.toBe(error);
    expect(request.onText).not.toHaveBeenCalled();
    expect(model.doStreamCalls).toHaveLength(1);
  });
  it("does not treat a partial answer followed by an error as a completed answer", async () => {
    const error = Object.assign(new Error("overloaded"), { statusCode: 503 });
    modelWith([
      { type: "text-start", id: "answer" },
      { type: "text-delta", id: "answer", delta: "180.000 Euro [C1].\n\n" },
      { type: "error", error },
    ]);
    await expect(generateGroundedAnswer(options())).rejects.toBe(error);
  });
  it("rejects an interrupted finish even if a valid paragraph arrived", async () => {
    modelWith([
      { type: "text-start", id: "answer" },
      { type: "text-delta", id: "answer", delta: "180.000 Euro [C1].\n\n" },
      { type: "text-end", id: "answer" },
      {
        ...finish,
        type: "finish",
        finishReason: { unified: "interrupted", raw: undefined },
      },
    ]);
    await expect(generateGroundedAnswer(options())).rejects.toThrow(
      "Unvollständiger",
    );
  });
  it("terminates a provider stream that never delivers content", async () => {
    state.model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: new ReadableStream<LanguageModelV4StreamPart>({ start() {} }),
      }),
    });
    const started = Date.now();
    await expect(generateGroundedAnswer(options())).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2000);
  }, 3000);
  it("respects cancellation before accepting provider output", async () => {
    modelWith([
      { type: "text-start", id: "answer" },
      { type: "text-delta", id: "answer", delta: "180.000 Euro [C1]." },
      { type: "text-end", id: "answer" },
      finish,
    ]);
    await expect(
      generateGroundedAnswer(
        options(AbortSignal.abort(new DOMException("cancelled", "AbortError"))),
      ),
    ).rejects.toThrow();
  });
});
describe("safe chat failure messages", () => {
  it("classifies provider overload and wrapped retry errors without exposing payloads", () => {
    const error = {
      lastError: { statusCode: 503, message: "secret key and document text" },
    };
    expect(chatFailure(error)).toMatchObject({ status: 503 });
    expect(chatFailure(error).message).toContain("ausgelastet");
    expect(chatFailure(error).message).not.toContain("secret");
  });
  it("distinguishes quota, invalid configuration and timeouts", () => {
    expect(chatFailure({ statusCode: 429 }).status).toBe(429);
    expect(chatFailure({ statusCode: 404 }).message).toContain("Modell");
    expect(
      chatFailure(new DOMException("timeout", "TimeoutError")).status,
    ).toBe(504);
    expect(chatFailure(new DOMException("abort", "AbortError")).status).toBe(
      504,
    );
  });
});
