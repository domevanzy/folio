"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Citation } from "@/lib/types";

export function Markdown({
  text,
  citations,
  onCitation,
}: {
  text: string;
  citations: Citation[];
  onCitation: (citation: Citation) => void;
}) {
  const citationIndexes = new Map(
    citations.map(({ id }, index) => [id, index]),
  );
  const marked = text.replace(/\[(C\d+)\]/g, (token, id: string) =>
    citationIndexes.has(id) ? `[${id}](#cite-${id})` : token,
  );
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const index = href?.startsWith("#cite-")
              ? citationIndexes.get(href.slice(6))
              : undefined;
            if (index === undefined) return <span>{children}</span>;

            const citation = citations[index];
            return (
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.focus();
                  onCitation(citation);
                }}
                aria-label={`Quelle ${index + 1}: ${citation.name}${citation.kind === "text" || citation.kind === "web" ? "" : `, Seite ${citation.page}`}`}
                className="mx-0.5 inline-flex min-h-6 items-center rounded px-0.5 text-xs font-semibold tabular-nums text-neutral-700 hover:bg-neutral-100 focus-visible:outline-2"
              >
                [{index + 1}]
              </button>
            );
          },
          img: () => null,
        }}
      >
        {marked}
      </ReactMarkdown>
    </div>
  );
}
