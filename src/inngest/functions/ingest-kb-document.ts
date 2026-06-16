import { inngest } from "@/infrastructure/events/inngest-client";
import { ingestKbDocument } from "@/application/services/ingest-kb-document";
import { createVoyageEmbeddingAdapter } from "@/infrastructure/adapters/voyage/embedding-adapter";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { logger } from "@/lib/logger";
import { flushPostHogTelemetry } from "@/lib/posthog-telemetry";

export const ingestKbDocumentJob = inngest.createFunction(
  {
    id: "ingest-kb-document",
    concurrency: [{ key: "event.data.orgId", limit: 1 }],
    retries: 5,
    timeouts: { finish: "10m" },
    triggers: [{ event: "kb.document.uploaded" }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event?.data as { documentId?: string } | undefined;
      const documentId = original?.documentId;
      if (!documentId) return;

      const db = getAdminClient();
      const message =
        error instanceof Error ? error.message : "Falha ao processar documento após várias tentativas.";

      await db
        .from("kb_documents")
        .update({
          status: "failed",
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);
    },
  },
  async ({ event }) => {
    const { orgId, documentId } = event.data as {
      orgId: string;
      documentId: string;
    };

    const embeddingProvider = createVoyageEmbeddingAdapter();
    if (!embeddingProvider) {
      throw new Error("VOYAGE_API_KEY is not set");
    }

    const db = getAdminClient();
    logger.info("Starting KB document ingest", { orgId, documentId });

    try {
      await ingestKbDocument(db, embeddingProvider, { orgId, documentId });
    } finally {
      await flushPostHogTelemetry();
    }
  },
);
