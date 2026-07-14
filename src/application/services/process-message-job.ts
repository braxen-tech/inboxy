import { processIncomingMessage } from "@/application/use-cases/process-incoming-message";
import { ClaudeAdapter } from "@/infrastructure/adapters/claude/adapter";
import { CalComAdapter } from "@/infrastructure/adapters/cal-com/adapter";
import { StripeCatalogAdapter, StripePaymentAdapter } from "@/infrastructure/adapters/stripe";
import { createVoyageEmbeddingAdapter } from "@/infrastructure/adapters/voyage/embedding-adapter";
import { PgVectorKnowledgeRetriever } from "@/infrastructure/adapters/pgvector/knowledge-retriever";
import { createToolRegistry } from "@/infrastructure/tools/bootstrap";
import { AesSecretStore } from "@/infrastructure/crypto/aes-secret-store";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { logger } from "@/lib/logger";
import { captureServerEvent, captureServerException } from "@/lib/posthog-server";
import { flushPostHogTelemetry } from "@/lib/posthog-telemetry";

export interface ProcessMessageJobInput {
  orgId: string;
  conversationId: string;
  messageId: string;
  correlationId: string;
}

/** Runs the AI reply pipeline (Inngest worker). */
export async function runProcessIncomingMessageJob(input: ProcessMessageJobInput): Promise<void> {
  const encryptionKey = process.env.ENCRYPTION_KEY?.trim();
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const db = getAdminClient();
  const agentRunner = new ClaudeAdapter();
  const voyage = createVoyageEmbeddingAdapter();
  const knowledgeRetriever = voyage ? new PgVectorKnowledgeRetriever(db, voyage) : undefined;
  const toolRegistry = createToolRegistry({
    calendarProvider: new CalComAdapter(),
    productCatalog: new StripeCatalogAdapter(),
    paymentGateway: new StripePaymentAdapter(),
    knowledgeRetriever,
    db,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  });
  const secretStore = new AesSecretStore(encryptionKey);

  await processIncomingMessage({ db, agentRunner, toolRegistry, secretStore }, input);
}

export async function runProcessIncomingMessageJobSafe(input: ProcessMessageJobInput): Promise<void> {
  try {
    await runProcessIncomingMessageJob(input);
  } catch (error) {
    logger.error("process-incoming-message job failed", {
      error: String(error),
      ...input,
    });
    captureServerEvent("message_processing_failed", {
      ...input,
      error_message: error instanceof Error ? error.message : String(error),
    });
    captureServerException(error, { ...input });
    throw error;
  } finally {
    await flushPostHogTelemetry();
  }
}
