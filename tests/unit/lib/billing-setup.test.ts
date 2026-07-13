import { afterEach, describe, it, expect } from "vitest";
import {
  needsBillingSetup,
  PILOT_SUBSCRIPTION_ID,
  isPilotMode,
} from "@/lib/billing-setup";

describe("needsBillingSetup", () => {
  const originalPilotMode = process.env.INBOXY_PILOT_MODE;

  afterEach(() => {
    if (originalPilotMode === undefined) {
      delete process.env.INBOXY_PILOT_MODE;
    } else {
      process.env.INBOXY_PILOT_MODE = originalPilotMode;
    }
  });

  it("requires checkout when subscription_id is missing", () => {
    expect(needsBillingSetup({ subscription_id: null })).toBe(true);
    expect(needsBillingSetup({})).toBe(true);
  });

  it("is complete when subscription_id is a real Stripe subscription", () => {
    expect(needsBillingSetup({ subscription_id: "sub_123" })).toBe(false);
  });

  it("allows pilot subscription while pilot mode is active", () => {
    process.env.INBOXY_PILOT_MODE = "true";
    expect(isPilotMode()).toBe(true);
    expect(needsBillingSetup({ subscription_id: PILOT_SUBSCRIPTION_ID })).toBe(false);
  });

  it("requires checkout for pilot subscription when pilot mode is off", () => {
    delete process.env.INBOXY_PILOT_MODE;
    expect(needsBillingSetup({ subscription_id: PILOT_SUBSCRIPTION_ID })).toBe(true);
  });
});
