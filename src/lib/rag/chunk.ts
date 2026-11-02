import type { Chunk } from "@/lib/types";
/** Prefer paragraph/sentence endings, preserve a bounded character overlap on the same page. */
export function chunkPages(
  pages: string[],
  target = 1800,
  overlap = 240,
): Chunk[] {
  if (target < 100 || overlap < 0 || overlap >= target)
    throw new Error("Invalid chunk bounds");
  const chunks: Chunk[] = [];
  pages.forEach((raw, page) => {
    const text = raw
      .replace(/\r/g, "")
      .replace(/[\t ]+/g, " ")
      .trim();
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + target, text.length);
      if (end < text.length) {
        const window = text.slice(start, end);
        const boundaries = [...window.matchAll(/(?:\n\s*\n|[.!?](?=\s))/g)];
        const last = boundaries.at(-1);
        if (last && last.index > target * 0.55)
          end = start + last.index + last[0].length;
      }
      const content = text.slice(start, end).trim();
      if (content)
        chunks.push({
          content,
          page_number: page + 1,
          chunk_index: chunks.length,
        });
      if (end === text.length) break;
      start = Math.max(start + 1, end - overlap);
    }
  });
  return chunks;
}
