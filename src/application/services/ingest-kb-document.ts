import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmbeddingProvider } from "@/domain/ports/embedding-provider";
import { documentTextExtractor } from "@/infrastructure/kb/extractors";
import { chunkText } from "@/infrastructure/kb/chunker";
import { MAX_KB_EXTRACT_CHARS, insertKbChunksInBatches } from "@/infrastructure/kb/chunk-storage";
import { buildEmbeddingBatches } from "@/infrastructure/adapters/voyage/embedding-batches";
import { sanitizeKnowledgeBase } from "@/infrastructure/security/sanitize";
import { KB_BUCKET } from "@/lib/kb-mime";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";

export interface IngestKbDocumentInput {
  orgId: string;
  documentId: string;
}

class KbIngestRateLimitedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KbIngestRateLimitedError";
  }
}

export async function ingestKbDocument(
  db: SupabaseClient,
  embeddingProvider: EmbeddingProvider,
  input: IngestKbDocumentInput,
): Promise<void> {
  const { orgId, documentId } = input;

  const { data: document, error: fetchError } = await db
    .from("kb_documents")
    .select("*")
    .eq("id", documentId)
    .eq("organization_id", orgId)
    .single();

  if (fetchError || !document) {
    throw new Error(`KB document not found: ${documentId}`);
  }

  await db
    .from("kb_documents")
    .update({ status: "processing", error_message: null, updated_at: new Date().toISOString() })
    .eq("id", documentId);

  try {
    const { data: fileData, error: downloadError } = await db.storage
      .from(KB_BUCKET)
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error(downloadError?.message ?? "Failed to download file from storage");
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const extractResult = await documentTextExtractor.extract(
      buffer,
      document.mime_type,
      document.filename,
    );

    if (!extractResult.ok) {
      await markFailed(db, documentId, extractResult.error.message);
      captureServerEvent("kb_document_ingest_failed", {
        org_id: orgId,
        document_id: documentId,
        reason: extractResult.error.code,
      });
      return;
    }

    const sanitized = sanitizeKnowledgeBase(extractResult.value);

    if (sanitized.length > MAX_KB_EXTRACT_CHARS) {
      await markFailed(
        db,
        documentId,
        `Documento extraiu ${sanitized.length.toLocaleString()} caracteres (máx. ${MAX_KB_EXTRACT_CHARS.toLocaleString()}). Divida em arquivos menores.`,
      );
      captureServerEvent("kb_document_ingest_failed", {
        org_id: orgId,
        document_id: documentId,
        reason: "extract_too_large",
      });
      return;
    }

    const chunks = chunkText(sanitized);

    if (chunks.length === 0) {
      await markFailed(
        db,
        documentId,
        "Nenhum conteúdo extraído do arquivo.",
      );
      captureServerEvent("kb_document_ingest_failed", {
        org_id: orgId,
        document_id: documentId,
        reason: "empty_content",
      });
      return;
    }

    await db.from("kb_chunks").delete().eq("document_id", documentId);

    const embeddingBatches = buildEmbeddingBatches(chunks);
    let chunkOffset = 0;

    logger.info("KB embedding batches", {
      orgId,
      documentId,
      chunkCount: chunks.length,
      batchCount: embeddingBatches.length,
    });

    for (const batch of embeddingBatches) {
      const embedResult = await embeddingProvider.embed(batch);
      if (!embedResult.ok) {
        if (embedResult.error.code === "RATE_LIMITED") {
          throw new KbIngestRateLimitedError(embedResult.error.message);
        }
        await markFailed(db, documentId, embedResult.error.message);
        captureServerEvent("kb_document_ingest_failed", {
          org_id: orgId,
          document_id: documentId,
          reason: "embedding_failed",
        });
        return;
      }

      const rows = batch.map((content, index) => ({
        organization_id: orgId,
        document_id: documentId,
        chunk_index: chunkOffset + index,
        content,
        embedding: embedResult.value[index]!,
      }));

      await insertKbChunksInBatches(db, rows);
      chunkOffset += batch.length;
    }

    await db
      .from("kb_documents")
      .update({
        status: "ready",
        error_message: null,
        char_count: sanitized.length,
        chunk_count: chunks.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    logger.info("KB document ingested", {
      orgId,
      documentId,
      chunkCount: chunks.length,
      charCount: sanitized.length,
    });

    captureServerEvent("kb_document_ingested", {
      org_id: orgId,
      document_id: documentId,
      chunk_count: chunks.length,
      char_count: sanitized.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("KB ingest failed", { orgId, documentId, error: message });

    if (err instanceof KbIngestRateLimitedError) {
      await db
        .from("kb_documents")
        .update({
          status: "processing",
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);
      throw err;
    }

    await markFailed(db, documentId, message);
    captureServerEvent("kb_document_ingest_failed", {
      org_id: orgId,
      document_id: documentId,
      reason: "exception",
    });
    throw err;
  }
}

async function markFailed(db: SupabaseClient, documentId: string, message: string) {
  await db
    .from("kb_documents")
    .update({
      status: "failed",
      error_message: message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);
}
