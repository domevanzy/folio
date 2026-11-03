import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checked } from "./http";
const DOCUMENT_BUCKET = "documents";
export function documentPath(
  userId: string,
  notebookId: string,
  sourceId: string,
) {
  return `${userId}/${notebookId}/${sourceId}.pdf`;
}

export function ownedDocumentPath(
  userId: string,
  notebookId: string,
  source: { id: string; storage_path: string | null },
) {
  // Older uploads could retain the case of a UUID from the request URL.
  return source.storage_path?.toLowerCase() ===
    documentPath(userId, notebookId, source.id)
    ? source.storage_path
    : null;
}

export function documentStorage(db: SupabaseClient) {
  return db.storage.from(DOCUMENT_BUCKET);
}
export async function removeDocumentFiles(db: SupabaseClient, paths: string[]) {
  // Supabase Storage accepts up to 1,000 paths per request.
  for (let start = 0; start < paths.length; start += 1000)
    checked(await documentStorage(db).remove(paths.slice(start, start + 1000)));
}
