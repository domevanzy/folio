import type { Citation } from "./types";
import { z } from "zod";
const citationSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  name: z.string(),
  page: z.number().int().positive(),
  excerpt: z.string(),
}) satisfies z.ZodType<Citation>;
export const chatStatusLabels = {
  retrieving: "Passende Textstellen werden gesucht …",
  generating: "Gemini formuliert die Antwort …",
  validating: "Quellenangaben werden geprüft …",
  saving: "Antwort wird gespeichert …",
} as const;
export type ChatStatus = keyof typeof chatStatusLabels;
export const chatEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("status"),
    stage: z.enum(["retrieving", "generating", "validating", "saving"]),
  }),
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({
    type: z.literal("done"),
    id: z.string(),
    citations: z.array(citationSchema),
  }),
  z.object({ type: z.literal("error"), error: z.string() }),
]);
export type ChatEvent = z.infer<typeof chatEventSchema>;
export type AnswerResult = {
  id: string;
  content: string;
  citations: z.infer<typeof citationSchema>[];
};
export const CHAT_STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";
export function encodeChatEvent(event: ChatEvent) {
  return new TextEncoder().encode(JSON.stringify(event) + "\n");
}
/** Decode arbitrary network boundaries, including split UTF-8 and a final line without newline. */
export async function* readChatEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let finished = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let end;
      while ((end = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 1);
        if (line.trim()) yield chatEventSchema.parse(JSON.parse(line));
      }
      if (done) {
        finished = true;
        if (pending.trim()) yield chatEventSchema.parse(JSON.parse(pending));
        break;
      }
    }
  } finally {
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
