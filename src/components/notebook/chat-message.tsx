import { memo } from "react";
import { chatStatusLabels, type ChatStatus } from "@/lib/chat-stream";
import { Layers2, Loader2 } from "lucide-react";
import type { Citation, Message } from "@/lib/types";
import { Markdown } from "../markdown";
export const ChatMessage = memo(function ChatMessage({
  message: m,
  onCitation,
  draft,
  status = "retrieving",
}: {
  message: Message;
  onCitation: (citation: Citation) => void;
  draft?: string;
  status?: ChatStatus;
}) {
  const citations = m.role === "assistant" ? (m.citations ?? []) : [];
  return (
    <div
      className={`mb-7 ${m.role === "user" ? "ml-auto w-fit max-w-[90%] rounded-2xl bg-[#e7ebf1] px-4 py-2 [&>.markdown>:first-child]:mt-0 [&>.markdown>:last-child]:mb-0" : "text-[13px]"}`}
    >
      {m.role === "assistant" && (
        <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold">
          <Layers2 size={14} className="text-[#687e9e]" /> FOLIO
        </div>
      )}
      {m.content ? (
        <Markdown
          text={m.content}
          citations={citations}
          onCitation={onCitation}
        />
      ) : (
        !draft && (
          <span role="status" className="flex items-center gap-2 text-xs muted">
            <Loader2 className="spinner" size={14} /> {chatStatusLabels[status]}
          </span>
        )
      )}
      {draft && (
        <div className="mt-2">
          <p className="mb-1 text-xs text-neutral-600">
            Entwurf · Quellenprüfung ausstehend
          </p>
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
            {draft}
          </p>
        </div>
      )}
      {citations.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-neutral-600">Quellenangaben</p>
          <ul className="flex flex-col gap-1.5">
            {citations.map((citation, index) => (
              <li key={citation.id} className="max-w-full">
                <button
                  type="button"
                  onClick={(event) => {
                    event.currentTarget.focus();
                    onCitation(citation);
                  }}
                  className="inline-flex min-h-6 max-w-full items-center gap-1.5 rounded bg-neutral-100 px-1.5 text-left text-xs leading-4 text-neutral-700 hover:bg-neutral-200 focus-visible:outline-2"
                >
                  <span className="shrink-0 font-semibold tabular-nums">
                    [{index + 1}]
                  </span>
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {citation.name}{" "}
                    {citation.kind !== "text" && citation.kind !== "web" && (
                      <span className="whitespace-nowrap">
                        · Seite {citation.page}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});
