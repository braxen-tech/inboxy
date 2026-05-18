import { serve } from "inngest/next";
import { inngest } from "@/infrastructure/events/inngest-client";
import { processMessage } from "@/inngest/functions/process-incoming-message";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processMessage],
});
