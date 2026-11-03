import { BookOpen, ChevronRight, Sparkles } from "lucide-react";
import { PanelHeader } from "./panel-header";
export function StudioPanel({
  active,
  disabled,
  onSummarize,
}: {
  active: boolean;
  disabled: boolean;
  onSummarize: () => void;
}) {
  return (
    <section
      className={`studio-panel panel flex min-h-0 flex-col ${active ? "mobile-active" : ""}`}
    >
      <PanelHeader icon={Sparkles} title="Studio" />
      <div className="overflow-auto p-4">
        <button
          onClick={onSummarize}
          disabled={disabled}
          className="group w-full rounded-2xl border border-[#d6dde7] bg-[#e7ebf2] p-4 text-left transition-colors hover:bg-[#d9e0ea] disabled:opacity-50"
        >
          <span className="mb-5 flex size-9 items-center justify-center rounded-xl bg-white/70 text-[#596f8f]">
            <BookOpen size={18} />
          </span>
          <h3 className="text-sm font-semibold">Zusammenfassung</h3>
          <p className="mt-2 text-xs leading-5 text-[#3e4c62]">
            Fasst ausgewählte Textstellen zusammen und speichert das Ergebnis im
            Chat.
          </p>
          <span className="mt-4 flex items-center gap-2 text-[10px] font-medium">
            Jetzt erstellen <ChevronRight size={12} />
          </span>
        </button>
      </div>
    </section>
  );
}
