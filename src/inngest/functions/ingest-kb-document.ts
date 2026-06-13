import { inngest } from "@/infrastructure/events/inngest-client";
import { ingestKbDocument } from "@/application/services/ingest-kb-document";
import { createVoyageEmbeddingAdapter } from "@/infrastructure/adapters/voyage/embedding-adapter";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { logger } from "@/lib/logger";

export const ingestKbDocumentJob = inngest.createFunction(
  {
    id: "ingest-kb-document",
    concurrency: [{ key: "event.data.orgId", limit: 2 }],
    retries: 2,
    triggers: [{ event: "kb.document.uploaded" }],
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

    await ingestKbDocument(db, embeddingProvider, { orgId, documentId });
  },
);
