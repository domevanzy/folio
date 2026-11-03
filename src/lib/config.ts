export const config = {
  chatModel: process.env.GEMINI_CHAT_MODEL || "gemini-3.5-flash-lite",
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
  dimensions: 768,
  maxBytes: 4 * 1024 * 1024,
  maxPages: 100,
  maxChunks: 240,
  topK: 10,
  minSimilarity: 0.3,
  chatRequestTimeoutMs: 90000,
  generationTimeoutMs: 60000,
  firstChunkTimeoutMs: 25000,
  chunkTimeoutMs: 15000,
  queryEmbeddingTimeoutMs: 20000,
};
export const configured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
