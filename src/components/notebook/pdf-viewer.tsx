import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
export type PdfDocument = {
  sourceId: string;
  name: string;
  page: number;
  url: string;
  excerpt?: string;
  excerptPage?: number;
};
export function PdfViewer({
  document,
  pageCount,
  onClose,
}: {
  document: PdfDocument;
  pageCount: number;
  onClose: () => void;
}) {
  const [page, setPage] = useState(document.page);
  const viewer = { ...document, page };
  return (
    <Modal
      titleId="pdf-title"
      onClose={onClose}
      overlayClassName="bg-[#14231b]/40 p-2 md:p-6"
      className="flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border-0 bg-white p-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <h2 id="pdf-title" className="max-w-[40%] truncate text-sm font-medium">
          {viewer.name}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Vorherige Seite"
            disabled={viewer.page <= 1}
            onClick={() => setPage(viewer.page - 1)}
          >
            <ChevronLeft size={15} />
          </Button>
          <label className="text-xs">
            Seite{" "}
            <input
              aria-label="PDF-Seite"
              type="number"
              min={1}
              max={pageCount}
              value={viewer.page}
              onChange={(e) => {
                const page = Number(e.target.value);
                const max = pageCount;
                if (Number.isInteger(page) && page >= 1 && page <= max)
                  setPage(page);
              }}
              className="w-12 rounded border p-1 text-center"
            />
          </label>
          <Button
            variant="outline"
            size="icon"
            aria-label="Nächste Seite"
            disabled={viewer.page >= pageCount}
            onClick={() => setPage(viewer.page + 1)}
          >
            <ChevronRight size={15} />
          </Button>
          <a
            href={`${viewer.url}#page=${viewer.page}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg p-2"
            title="PDF in neuem Tab öffnen"
          >
            <ExternalLink size={16} />
          </a>
          <Button
            variant="ghost"
            size="icon"
            aria-label="PDF schließen"
            onClick={onClose}
          >
            <X size={19} />
          </Button>
        </div>
      </div>
      {viewer.excerpt && (
        <details className="border-b bg-[#f5f8ef] px-5 py-3 text-xs">
          <summary className="cursor-pointer font-medium">
            Zitierte Textstelle · Seite {viewer.excerptPage}
          </summary>
          <p className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap leading-6 muted">
            {viewer.excerpt}
          </p>
        </details>
      )}
      <iframe
        key={`${viewer.url}-${viewer.page}`}
        src={`${viewer.url}#page=${viewer.page}`}
        title={`${viewer.name}, Seite ${viewer.page}`}
        className="min-h-0 w-full flex-1 border-0 bg-[#f2f3ee]"
      />
      <p className="p-2 text-center text-[10px] muted">
        Falls dein Browser kein PDF anzeigt: über das Pfeilsymbol in einem neuen
        Tab öffnen. Der Link ist 2 Minuten gültig.
      </p>
    </Modal>
  );
}
