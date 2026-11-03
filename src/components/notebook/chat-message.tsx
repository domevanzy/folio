import { memo } from "react";
import { chatStatusLabels, type ChatStatus } from "@/lib/chat-stream";
import { FileText, Layers2, Loader2 } from "lucide-react";
import type { Citation, Message } from "@/lib/types";
import { Markdown } from "../markdown";
export const ChatMessage = memo(function ChatMessage({
  message: m,
  onCitation,
  status = "retrieving",
}: {
  message: Message;
  onCitation: (citation: Citation) => void;
  status?: ChatStatus;
}) {
  return (
    <div
      className={`mb-7 ${m.role === "user" ? "ml-auto max-w-[90%] rounded-2xl bg-[#edf2e6] px-4 py-3" : "text-[13px]"}`}
    >
      {m.role === "assistant" && (
        <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold">
          <Layers2 size={14} className="text-[#82986e]" /> FOLIO
        </div>
      )}
      {m.content ? (
        <Markdown
          text={m.content}
          citations={m.citations || []}
          onCitation={onCitation}
        />
      ) : (
        <span role="status" className="flex items-center gap-2 text-xs muted">
          <Loader2 className="spinner" size={14} /> {chatStatusLabels[status]}
        </span>
      )}
      {m.role === "assistant" && m.citations?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {m.citations.map((c) => (
            <button
              key={c.id}
              onClick={(event) => {
                event.currentTarget.focus();
                onCitation(c);
              }}
              title={c.excerpt}
              className="flex max-w-full items-center gap-1.5 rounded-lg border border-[#e0e8d9] bg-[#f8faf5] px-2 py-1.5 text-[9px] text-[#6c805e]"
            >
              <FileText size={11} />
              <span className="max-w-36 truncate">{c.name}</span>
              <span>· S. {c.page}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
