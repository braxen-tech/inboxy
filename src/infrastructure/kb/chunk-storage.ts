import type { SupabaseClient } from "@supabase/supabase-js";

/** Max extracted text per KB document (~125 chunks at 3200 chars). */
export const MAX_KB_EXTRACT_CHARS = 400_000;

const KB_CHUNK_INSERT_BATCH_SIZE = 25;

export async function insertKbChunksInBatches(
  db: SupabaseClient,
  rows: Array<{
    organization_id: string;
    document_id: string;
    chunk_index: number;
    content: string;
    embedding: number[];
  }>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += KB_CHUNK_INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + KB_CHUNK_INSERT_BATCH_SIZE);
    const { error } = await db.from("kb_chunks").insert(batch);
    if (error) {
      throw new Error(error.message);
    }
  }
}
