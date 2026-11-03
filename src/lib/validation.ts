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
