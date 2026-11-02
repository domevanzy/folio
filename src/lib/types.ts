export type Notebook = { id: string; title: string; created_at: string };
export type Source = {
  id: string;
  name: string;
  status: "processing" | "ready" | "failed";
  page_count: number;
  error: string | null;
  created_at: string;
};
export type Citation = {
  id: string;
  sourceId: string;
  name: string;
  page: number;
  excerpt: string;
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
};
export type Chunk = {
  content: string;
  page_number: number;
  chunk_index: number;
};
