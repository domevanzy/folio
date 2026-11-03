import { describe, it, expect } from "vitest";
import { validateCitations, groundedParagraph } from "@/lib/rag/citations";
const refs = [
  {
    id: "C1",
    sourceId: "source-a",
    page: 7,
    name: "paper.pdf",
    excerpt: "Evidence",
  },
];
describe("server citation validation", () => {
  it("uses metadata from retrieval, deduplicates and rejects fabricated ids", () => {
    const result = validateCitations(
      "Belegt [C1]. Wiederholt [C1]. Erfunden [C999].",
      refs,
    );
    expect(result.citations).toEqual(refs);
    expect(result.content).not.toContain("C999");
    expect(result.rejected).toBe(true);
  });
  it("rejects alternate spelling and ids from previous turns", () => {
    expect(validateCitations("[c1] [C01] [C2] [C-1]", refs).citations).toEqual(
      [],
    );
  });
  it("withholds ungrounded paragraphs", () => {
    expect(groundedParagraph("Unbelegte Behauptung.", refs)).toContain(
      "keine überprüfbare Quellenbasis",
    );
    expect(groundedParagraph("Belegt [C1].", refs)).toBe("Belegt [C1].");
  });
  it("has no sources when retrieval is empty", () => {
    expect(validateCitations("Fake [C1]", []).citations).toEqual([]);
  });
});
