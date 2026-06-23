import { dispatchFollowups } from "@/application/use-cases/dispatch-followups";
import { ChatwootAdapter } from "@/infrastructure/adapters/chatwoot/adapter";
import { AesSecretStore } from "@/infrastructure/crypto/aes-secret-store";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { logger } from "@/lib/logger";
import { captureServerException } from "@/lib/posthog-server";
import { flushPostHogTelemetry } from "@/lib/posthog-telemetry";

export async function runFollowupDispatchJob(): Promise<void> {
  const encryptionKey = process.env.ENCRYPTION_KEY?.trim();
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY is not set");
  }

  const db = getAdminClient();
  const messagingChannel = new ChatwootAdapter();
  const secretStore = new AesSecretStore(encryptionKey);

  await dispatchFollowups({ db, messagingChannel, secretStore });
}

export async function runFollowupDispatchJobSafe(): Promise<void> {
  try {
    await runFollowupDispatchJob();
  } catch (error) {
    logger.error("followup-dispatch job failed", { error: String(error) });
    captureServerException(error);
    throw error;
  } finally {
    await flushPostHogTelemetry();
  }
}
