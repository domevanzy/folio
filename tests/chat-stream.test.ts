import { describe, it, expect } from "vitest";
import {
  encodeChatEvent,
  readChatEvents,
  type ChatEvent,
} from "@/lib/chat-stream";
async function collect(stream: ReadableStream<Uint8Array>) {
  const events: ChatEvent[] = [];
  for await (const event of readChatEvents(stream)) events.push(event);
  return events;
}
describe("shared chat stream protocol", () => {
  it("decodes UTF-8 and events across arbitrary byte boundaries", async () => {
    const events: ChatEvent[] = [
      { type: "text", text: "Überprüfbar [C1]." },
      {
        type: "done",
        id: "message",
        citations: [
          {
            id: "C1",
            sourceId: "source",
            name: "Dokument.pdf",
            page: 2,
            excerpt: "Überprüfbar",
          },
        ],
      },
    ];
    const bytes = new TextEncoder().encode(
      events
        .map((event) => new TextDecoder().decode(encodeChatEvent(event)))
        .join(""),
    );
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
        c.close();
      },
    });
    expect(await collect(stream)).toEqual(events);
  });
  it("accepts final events without newline and retains server errors", async () => {
    const event = { type: "error", error: "Unterbrochen" } as const;
    const bytes = encodeChatEvent(event);
    expect(
      await collect(
        new ReadableStream({
          start(c) {
            c.enqueue(bytes.slice(0, -1));
            c.close();
          },
        }),
      ),
    ).toEqual([event]);
  });
  it("rejects malformed events and cancels the upstream reader", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('{"type":"done","citations":[]}\n'));
      },
      cancel() {
        cancelled = true;
      },
    });
    await expect(collect(stream)).rejects.toThrow();
    expect(cancelled).toBe(true);
  });
});
