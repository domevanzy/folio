import "server-only";
import { config } from "@/lib/config";
import { HttpError } from "@/lib/http";
export async function extractPdf(bytes: Uint8Array) {
  if (
    bytes.length > config.maxBytes ||
    new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
  )
    throw new HttpError(400, "Ungültige PDF-Datei (maximal 4 MiB).");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: bytes,
    useSystemFonts: true,
    disableFontFace: true,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > config.maxPages)
      throw new HttpError(400, "Maximal 100 Seiten pro PDF.");
    const pages: string[] = [];
    let chars = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const data = await page.getTextContent();
      const text = data.items
        .map((item) =>
          "str" in item
            ? item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")
            : "",
        )
        .join("");
      chars += text.length;
      if (chars > 400000)
        throw new HttpError(
          400,
          "Das PDF enthält zu viel Text. Bitte aufteilen.",
        );
      pages.push(text);
      page.cleanup();
    }
    if (pages.join("").trim().length < 40)
      throw new HttpError(
        400,
        "Kein ausreichender Text gefunden. Gescannte PDFs benötigen vorher OCR.",
      );
    return pages;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "PDF nicht lesbar oder passwortgeschützt.");
  } finally {
    await task.destroy();
  }
}
