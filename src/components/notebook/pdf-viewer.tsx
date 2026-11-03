import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
export type PdfDocument = {
  sourceId: string;
  name: string;
  page: number;
  url: string;
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
      overlayClassName="bg-[#131a24]/40 p-2 md:p-6"
      className="flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border-0 bg-white p-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <h2
          id="pdf-title"
          className="min-w-0 flex-1 break-words text-sm font-medium"
        >
          {viewer.name}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="PDF schließen"
          onClick={onClose}
        >
          <X size={19} />
        </Button>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b p-3">
        <a
          href={`${viewer.url}#page=${viewer.page}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-sm font-medium underline underline-offset-4"
        >
          <ExternalLink size={16} aria-hidden="true" /> PDF in neuem Tab öffnen
        </a>
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
        </div>
      </div>
      <iframe
        key={`${viewer.url}-${viewer.page}`}
        src={`${viewer.url}#page=${viewer.page}`}
        title={`${viewer.name}, Seite ${viewer.page}`}
        className="min-h-0 w-full flex-1 border-0 bg-[#eef0f3]"
      />
    </Modal>
  );
}
