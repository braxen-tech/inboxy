import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPostHogAiTraces, registerPostHogAiSpanProcessor } from "@/lib/posthog-ai-traces";

describe("posthog-ai-traces", () => {
  afterEach(() => {
    registerPostHogAiSpanProcessor({
      forceFlush: vi.fn().mockResolvedValue(undefined),
    } as never);
  });

  it("flushes the registered span processor", async () => {
    const forceFlush = vi.fn().mockResolvedValue(undefined);
    registerPostHogAiSpanProcessor({ forceFlush } as never);

    await flushPostHogAiTraces();

    expect(forceFlush).toHaveBeenCalledOnce();
  });
});
