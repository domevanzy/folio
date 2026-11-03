import type { Citation } from "@/lib/types";
/** Only canonical [C<number>] tokens from this request's retrieval set survive. */
export function validateCitations(text: string, allowed: Citation[]) {
  const map = new Map(allowed.map((c) => [c.id, c]));
  const used = new Set<string>();
  let rejected = false;
  const content = text.replace(/\[C[^\]\n]*\]/gi, (token) => {
    const id = token.slice(1, -1);
    if (!map.has(id)) {
      rejected = true;
      return "";
    }
    used.add(id);
    return token;
  });
  return { content, citations: [...used].map((id) => map.get(id)!), rejected };
}
export const missingParagraphEvidence =
  "Für diesen Abschnitt liegt keine überprüfbare Quellenbasis vor.\n\n";

/** Each streamed paragraph must carry a known reference; ungrounded paragraphs are withheld. */
export function groundedParagraph(text: string, allowed: Citation[]) {
  const validated = validateCitations(text, allowed);
  return validated.citations.length
    ? validated.content
    : missingParagraphEvidence;
}
