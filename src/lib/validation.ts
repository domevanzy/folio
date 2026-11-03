import { z } from "zod";
import { config } from "./config";
export const notebookTitleSchema = z.object({
  title: z.string().trim().min(1).max(120),
});
export const PDF_UPLOAD_ERROR = "Bitte eine PDF-Datei bis 4 MiB auswählen.";
export function isValidPdfFile(file: Pick<File, "name" | "type" | "size">) {
  return (
    file.size > 0 &&
    file.size <= config.maxBytes &&
    file.type === "application/pdf" &&
    file.name.toLowerCase().endsWith(".pdf")
  );
}

export const maxSourceText = 100_000;
export const webSourceUrl = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.port
    );
  }, "Bitte eine öffentliche HTTP- oder HTTPS-Adresse eingeben.");

export const writtenSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    name: z.string().trim().min(1).max(180),
    content: z.string().trim().min(1).max(maxSourceText),
  }),
  z.object({ kind: z.literal("web"), url: webSourceUrl }),
]);
