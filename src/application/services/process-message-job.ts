import { processIncomingMessage } from "@/application/use-cases/process-incoming-message";
import { ChatwootAdapter } from "@/infrastructure/adapters/chatwoot/adapter";
import { ClaudeAdapter } from "@/infrastructure/adapters/claude/adapter";
import { CalComAdapter } from "@/infrastructure/adapters/cal-com/adapter";
import { StripeCatalogAdapter, StripePaymentAdapter } from "@/infrastructure/adapters/stripe";
import { createToolRegistry } from "@/infrastructure/tools/bootstrap";
import { AesSecretStore } from "@/infrastructure/crypto/aes-secret-store";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { logger } from "@/lib/logger";
import {
  captureServerEvent,
  captureServerException,
  shutdownPostHog,
} from "@/lib/posthog-server";

export interface ProcessMessageJobInput {
  orgId: string;
  conversationId: string;
  messageId: string;
  correlationId: string;
}

/** Runs the AI reply pipeline (shared by Inngest and inline Chatwoot processing). */
export async function runProcessIncomingMessageJob(
  input: ProcessMessageJobInput,
): Promise<void> {
  const encryptionKey = process.env.ENCRYPTION_KEY?.trim();
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const db = getAdminClient();
  const messagingChannel = new ChatwootAdapter();
  const agentRunner = new ClaudeAdapter();
  const toolRegistry = createToolRegistry({
    calendarProvider: new CalComAdapter(),
    productCatalog: new StripeCatalogAdapter(),
    paymentGateway: new StripePaymentAdapter(),
    db,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  });
  const secretStore = new AesSecretStore(encryptionKey);

  await processIncomingMessage(
    { db, agentRunner, messagingChannel, toolRegistry, secretStore },
    input,
  );
}

export async function runProcessIncomingMessageJobSafe(
  input: ProcessMessageJobInput,
): Promise<void> {
  try {
    await runProcessIncomingMessageJob(input);
  } catch (error) {
    logger.error("process-incoming-message job failed", {
      error: String(error),
      ...input,
    });
    captureServerEvent("message_processing_failed", { ...input });
    captureServerException(error, { ...input });
    const db = getAdminClient();
    await db.from("webhook_failures").insert({
      payload: input,
      error: String(error),
    });
    await shutdownPostHog();
    throw error;
  }
}
