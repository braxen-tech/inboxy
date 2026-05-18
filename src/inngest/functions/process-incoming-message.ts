import { inngest } from "@/infrastructure/events/inngest-client";
import { processIncomingMessage } from "@/application/use-cases/process-incoming-message";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { WhatsAppCloudAdapter } from "@/infrastructure/adapters/whatsapp-cloud/adapter";
import { ClaudeAdapter } from "@/infrastructure/adapters/claude/adapter";
import { InMemoryToolRegistry } from "@/infrastructure/tools/registry";
import { AesSecretStore } from "@/infrastructure/crypto/aes-secret-store";
import { logger } from "@/lib/logger";

export const processMessage = inngest.createFunction(
  {
    id: "process-incoming-message",
    concurrency: [{ key: "event.data.conversationId", limit: 1 }],
    retries: 2,
    triggers: [{ event: "message.received" }],
  },
  async ({ event }) => {
    const { orgId, conversationId, messageId, correlationId } = event.data as {
      orgId: string;
      conversationId: string;
      messageId: string;
      correlationId: string;
    };

    try {
      const db = getAdminClient();
      const messagingChannel = new WhatsAppCloudAdapter();
      const agentRunner = new ClaudeAdapter();
      const toolRegistry = new InMemoryToolRegistry();
      const secretStore = new AesSecretStore(process.env.ENCRYPTION_KEY!);

      await processIncomingMessage(
        { db, agentRunner, messagingChannel, toolRegistry, secretStore },
        { orgId, conversationId, messageId, correlationId },
      );
    } catch (error) {
      logger.error("Inngest process-incoming-message failed", {
        error: String(error),
        orgId,
        conversationId,
        correlationId,
      });

      const db = getAdminClient();
      await db.from("webhook_failures").insert({
        payload: { orgId, conversationId, messageId, correlationId },
        error: String(error),
      });

      throw error;
    }
  },
);
