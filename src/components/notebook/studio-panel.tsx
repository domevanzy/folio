import {
  BookOpen,
  ChevronRight,
  Lightbulb,
  Quote,
  Sparkles,
} from "lucide-react";
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
        <p className="muted mb-4 text-[11px] leading-5">
          Ein neuer Blick auf dein Wissen.
        </p>
        <button
          onClick={onSummarize}
          disabled={disabled}
          className="group w-full rounded-2xl border border-[#dfe8d5] bg-[#edf3e6] p-4 text-left transition-colors hover:bg-[#e2ecd7] disabled:opacity-50"
        >
          <span className="mb-5 flex size-9 items-center justify-center rounded-xl bg-white/70 text-[#738c5c]">
            <BookOpen size={18} />
          </span>
          <h3 className="text-sm font-semibold">Zusammenfassung</h3>
          <p className="mt-2 text-[11px] leading-5 text-[#7a896c]">
            Die zentralen Gedanken deiner Quellen im Überblick.
          </p>
          <span className="mt-4 flex items-center gap-2 text-[10px] font-medium">
            Jetzt erstellen <ChevronRight size={12} />
          </span>
        </button>
        <div className="mt-5 rounded-xl border border-[#e9ece3] p-4">
          <span className="mb-2 flex items-center gap-2 text-xs font-medium">
            <Lightbulb size={15} className="text-[#aa9f70]" /> Ein guter
            Ausgangspunkt
          </span>
          <p className="text-[11px] leading-6 muted">
            Frag nach Gemeinsamkeiten, lass dir einen Begriff erklären oder
            untersuche eine bestimmte Aussage.
          </p>
        </div>
        <p className="muted mt-4 px-1 text-[10px] leading-5">
          Zusammenfassungen verwenden eine Auswahl von Textstellen und werden im
          Chat gespeichert.
        </p>
      </div>
      <div className="mt-auto p-5">
        <div className="border-t border-[#eef0e8] pt-4">
          <Quote size={18} className="mb-3 text-[#bdcbb0]" />
          <p className="serif text-lg italic text-[#8b9a7c]">
            Gute Fragen öffnen
            <br />
            neue Perspektiven.
          </p>
        </div>
      </div>
    </section>
  );
}
