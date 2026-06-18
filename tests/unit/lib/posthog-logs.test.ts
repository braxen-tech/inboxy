import { describe, expect, it } from "vitest";
import { getPostHogLogsOtlpConfig } from "@/lib/posthog-logs";

describe("getPostHogLogsOtlpConfig", () => {
  it("sets required Content-Type and token query param", () => {
    const config = getPostHogLogsOtlpConfig("https://us.i.posthog.com", "phc_test");

    expect(config.url).toBe("https://us.i.posthog.com/i/v1/logs?token=phc_test");
    expect(config.headers["Content-Type"]).toBe("application/json");
  });
});
