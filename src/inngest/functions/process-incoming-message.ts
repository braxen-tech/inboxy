import { inngest } from "@/infrastructure/events/inngest-client";
import { runProcessIncomingMessageJobSafe } from "@/application/services/process-message-job";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { captureServerException } from "@/lib/posthog-server";
import { flushPostHogTelemetry } from "@/lib/posthog-telemetry";

export const processMessage = inngest.createFunction(
  {
    id: "process-incoming-message",
    concurrency: [{ key: "event.data.conversationId", limit: 1 }],
    retries: 2,
    timeouts: { finish: "5m" },
    triggers: [{ event: "message.received" }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event?.data as
        | {
            orgId?: string;
            conversationId?: string;
            messageId?: string;
            correlationId?: string;
          }
        | undefined;

      if (!original?.messageId) return;

      const db = getAdminClient();
      const message =
        error instanceof Error
          ? error.message
          : "Falha ao processar mensagem após várias tentativas.";

      captureServerException(error, original);

      await db.from("webhook_failures").insert({
        payload: original,
        error: message,
      });

      await flushPostHogTelemetry();
    },
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
