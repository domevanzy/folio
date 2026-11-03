import { ExternalLink, X } from "lucide-react";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
export type PdfDocument = {
  name: string;
  page: number;
  url: string;
};
export function PdfViewer({
  document,
  onClose,
}: {
  document: PdfDocument;
  onClose: () => void;
}) {
  const pageUrl = `${document.url}#page=${document.page}`;
  return (
    <Modal
      titleId="pdf-title"
      onClose={onClose}
      overlayClassName="bg-[#131a24]/40 p-2 md:p-6"
      className="flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border-0 bg-white p-0"
    >
      <div className="flex shrink-0 items-center gap-3 border-b p-4">
        <h2
          id="pdf-title"
          className="min-w-0 flex-1 break-words text-sm font-medium"
        >
          {document.name}
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
      <iframe
        src={pageUrl}
        title={`${document.name}, Seite ${document.page}`}
        className="min-h-0 w-full flex-1 border-0 bg-[#eef0f3]"
      />
    </Modal>
  );
}
