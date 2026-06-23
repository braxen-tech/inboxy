import { inngest } from "@/infrastructure/events/inngest-client";
import { runFollowupDispatchJobSafe } from "@/application/services/followup-job";

export const followupDispatch = inngest.createFunction(
  {
    id: "followup-dispatch",
    retries: 1,
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async () => {
    await runFollowupDispatchJobSafe();
  },
);
