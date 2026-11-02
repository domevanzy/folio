import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed, embedMany } from "ai";
import { config } from "@/lib/config";
import { HttpError } from "@/lib/http";
export function google() {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY)
    throw new HttpError(503, "Der Gemini-API-Key ist noch nicht eingerichtet.");
  return createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
}
function embeddingOptions(taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT") {
  return {
    model: google().embedding(config.embeddingModel),
    providerOptions: {
      google: { outputDimensionality: config.dimensions, taskType },
    },
    maxRetries: 2,
  };
}
export async function embedQuery(value: string, signal?: AbortSignal) {
  return (
    await embed({
      ...embeddingOptions("RETRIEVAL_QUERY"),
      value,
      maxRetries: 0,
      abortSignal: signal
        ? AbortSignal.any([
            signal,
            AbortSignal.timeout(config.queryEmbeddingTimeoutMs),
          ])
        : AbortSignal.timeout(config.queryEmbeddingTimeoutMs),
    })
  ).embedding;
}
export async function embedDocuments(values: string[]) {
  return (
    await embedMany({
      ...embeddingOptions("RETRIEVAL_DOCUMENT"),
      values,
      maxParallelCalls: 2,
    })
  ).embeddings;
}
