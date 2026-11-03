import { useState } from "react";
import { ExternalLink, X } from "lucide-react";
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
  onClose,
}: {
  document: PdfDocument;
  onClose: () => void;
}) {
  const [showPreview, setShowPreview] = useState(!document.excerpt);
  const viewer = document;
  const pageUrl = `${viewer.url}#page=${viewer.page}`;
  return (
    <Modal
      titleId="pdf-title"
      onClose={onClose}
      overlayClassName="bg-[#14231b]/40 p-2 md:p-6"
      className={`flex ${showPreview ? "h-full max-w-6xl" : "max-h-full max-w-2xl"} flex-col overflow-hidden rounded-2xl border-0 bg-white p-0`}
    >
      <div className="flex shrink-0 items-center gap-3 border-b p-4">
        <h2
          id="pdf-title"
          className="min-w-0 flex-1 break-words text-sm font-medium"
        >
          {viewer.name}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild variant="ghost" size="icon">
            <a
              href={pageUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="PDF in neuem Tab öffnen"
              title="PDF in neuem Tab öffnen"
            >
              <ExternalLink size={19} aria-hidden="true" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="PDF schließen"
            onClick={onClose}
          >
            <X size={19} aria-hidden="true" />
          </Button>
        </div>
      </div>
      {viewer.excerpt && (
        <section
          aria-label="Zitierte Textstelle"
          className="min-h-0 overflow-auto border-b bg-[#f5f8ef] px-4 py-4 sm:px-6"
        >
          <h3 className="text-sm font-semibold">
            Zitierte Textstelle · Seite {viewer.excerptPage}
          </h3>
          <p
            className={`mt-2 max-w-[72ch] whitespace-pre-wrap text-sm leading-relaxed text-[#364437] ${showPreview ? "max-h-[24dvh] overflow-auto" : ""}`}
          >
            {viewer.excerpt}
          </p>
        </section>
      )}
      {viewer.excerpt && (
        <div className="flex shrink-0 border-b p-3">
          <Button
            variant="outline"
            aria-expanded={showPreview}
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? "Vorschau ausblenden" : "PDF-Vorschau anzeigen"}
          </Button>
        </div>
      )}
      {showPreview && (
        <iframe
          src={pageUrl}
          title={`${viewer.name}, Seite ${viewer.page}`}
          className="min-h-0 w-full flex-1 border-0 bg-[#f2f3ee]"
        />
      )}
    </Modal>
  );
}
