import { describe, it, expect } from "vitest";
import { needsBillingSetup } from "@/lib/billing-setup";

describe("needsBillingSetup", () => {
  it("defaults missing subscription_status to trialing (no setup required)", () => {
    expect(needsBillingSetup({})).toBe(false);
    expect(needsBillingSetup({ subscription_status: null })).toBe(false);
  });

  it("is complete when subscription is active or trialing", () => {
    expect(needsBillingSetup({ subscription_status: "active" })).toBe(false);
    expect(needsBillingSetup({ subscription_status: "trialing" })).toBe(false);
  });

  it("requires checkout when subscription is past_due, canceled, or unpaid", () => {
    expect(needsBillingSetup({ subscription_status: "past_due" })).toBe(true);
    expect(needsBillingSetup({ subscription_status: "canceled" })).toBe(true);
    expect(needsBillingSetup({ subscription_status: "unpaid" })).toBe(true);
  });
});
