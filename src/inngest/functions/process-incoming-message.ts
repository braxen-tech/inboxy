import { inngest } from "@/infrastructure/events/inngest-client";
import { runProcessIncomingMessageJobSafe } from "@/application/services/process-message-job";

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

    await runProcessIncomingMessageJobSafe({
      orgId,
      conversationId,
      messageId,
      correlationId,
    });
  },
);
