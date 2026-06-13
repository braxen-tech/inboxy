import { serve } from "inngest/next";
import { inngest } from "@/infrastructure/events/inngest-client";
import { processMessage } from "@/inngest/functions/process-incoming-message";
import { ingestKbDocumentJob } from "@/inngest/functions/ingest-kb-document";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processMessage, ingestKbDocumentJob],
});
