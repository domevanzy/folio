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
  const allowed = new Set(citations.map((c) => c.id));
  const marked = text.replace(/\[(C\d+)\]/g, (token, id) =>
    allowed.has(id) ? `[${id}](#cite-${id})` : token,
  );
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const id = href?.startsWith("#cite-") ? href.slice(6) : null;
            const citation = citations.find((c) => c.id === id);
            return citation ? (
              <button
                onClick={() => onCitation(citation)}
                title={`${citation.name}, Seite ${citation.page}`}
                className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-[#e5eddc] px-1 text-[10px] font-semibold text-[#4d6b39]"
              >
                {citation.id.slice(1)}
              </button>
            ) : (
              <span>{children}</span>
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
