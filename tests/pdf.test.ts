import { describe, it, expect } from "vitest";
import { extractPdf } from "@/lib/rag/pdf";
function pdfFixture(pageCount = 2) {
  const objects: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", ""];
  const pageIds: number[] = [];
  for (let i = 0; i < pageCount; i++) {
    const pageId = objects.length + 1;
    pageIds.push(pageId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${pageId + 1} 0 R >>`,
    );
    const stream = `BT /F1 12 Tf 50 750 Td (Page ${i + 1} contains unique research evidence for Folio extraction.) Tj ET`;
    objects.push(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;
  let document = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(document));
    document += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${n.toString().padStart(10, "0")} 00000 n \n`)
    .join(
      "",
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(document));
}
describe("real server-side PDF extraction", () => {
  it("extracts real PDF bytes with separate, correctly ordered pages", async () => {
    const pages = await extractPdf(pdfFixture());
    expect(pages).toHaveLength(2);
    expect(pages[0]).toContain("Page 1 contains");
    expect(pages[1]).toContain("Page 2 contains");
    expect(pages[0]).not.toContain("Page 2");
  });
  it("rejects disguised non-PDFs and oversized payloads", async () => {
    await expect(
      extractPdf(new TextEncoder().encode("<html>fake.pdf</html>")),
    ).rejects.toThrow("Ungültige PDF");
    await expect(
      extractPdf(new Uint8Array(4 * 1024 * 1024 + 1)),
    ).rejects.toThrow("Ungültige PDF");
  });
  it("rejects corrupt PDFs and enforces page limits", async () => {
    await expect(
      extractPdf(new TextEncoder().encode("%PDF-1.4 corrupt")),
    ).rejects.toThrow("PDF nicht lesbar");
    await expect(extractPdf(pdfFixture(101))).rejects.toThrow("100 Seiten");
  });
});
