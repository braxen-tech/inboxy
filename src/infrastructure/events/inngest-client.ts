import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "inboxy-crm",
});

/** Ensures INNGEST_EVENT_KEY is set before calling inngest.send() in production. */
export function assertInngestEventKeyConfigured(): void {
  if (process.env.INNGEST_DEV === "1" || process.env.NODE_ENV === "test") {
    return;
  }

  const key = process.env.INNGEST_EVENT_KEY?.trim();
  if (!key) {
    throw new Error(
      "INNGEST_EVENT_KEY is not set. In Inngest: Manage → Event keys → create/copy key, " +
        "then add it to Vercel (Production) and redeploy.",
    );
  }
  if (key.startsWith("signkey")) {
    throw new Error(
      "INNGEST_EVENT_KEY must be an Event Key, not the Signing Key. " +
        "In Inngest: Manage → Event keys (separate from Signing Key).",
    );
  }
  if (key.startsWith("sk-inn-api")) {
    throw new Error(
      "INNGEST_EVENT_KEY is an Inngest API key (sk-inn-api...), not an Event Key. " +
        "In Inngest: Manage → Event keys → Create Event Key. Do not reuse the Signing Key tab.",
    );
  }
}
