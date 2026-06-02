import { describe, it, expect } from "vitest";
import { needsBillingSetup } from "@/lib/billing-setup";

describe("needsBillingSetup", () => {
  it("requires checkout when subscription_id is missing", () => {
    expect(needsBillingSetup({ subscription_id: null })).toBe(true);
    expect(needsBillingSetup({})).toBe(true);
  });

  it("is complete when subscription_id exists", () => {
    expect(needsBillingSetup({ subscription_id: "sub_123" })).toBe(false);
  });
});
