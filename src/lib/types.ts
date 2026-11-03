export type Notebook = { id: string; title: string; created_at: string };
export type SourceKind = "pdf" | "text" | "web";
export type Source = {
  id: string;
  name: string;
  kind: SourceKind;
  status: "processing" | "ready" | "failed";
  page_count: number;
  error: string | null;
  created_at: string;
};
export type SourcePreview =
  | { kind: "pdf"; url: string }
  | { kind: "text" | "web"; content: string; originalUrl: string | null };
export type Citation = {
  id: string;
  sourceId: string;
  name: string;
  page: number;
  excerpt: string;
  kind?: SourceKind;
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
