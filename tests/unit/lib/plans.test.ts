import { describe, it, expect } from "vitest";
import {
  PLANS,
  resolveAllowedTools,
  resolveEnabledToolsForOrg,
  planFromStripePriceId,
  getStripePriceId,
} from "@/lib/plans";

describe("plans", () => {
  it("starter has no integrations", () => {
    expect(PLANS.starter.allowedIntegrations).toEqual([]);
    expect(resolveAllowedTools([])).toEqual([]);
  });

  it("professional resolves cal and stripe tools", () => {
    const tools = resolveAllowedTools(PLANS.professional.allowedIntegrations);
    expect(tools).toContain("check_calendar_availability");
    expect(tools).toContain("create_checkout");
  });

  it("resolveEnabledToolsForOrg gates by plan and connection", () => {
    const starterOnly = resolveEnabledToolsForOrg({
      subscription_plan: "starter",
      cal_status: "active",
      cal_api_key: "x",
      cal_event_type_id: "1",
      stripe_status: "active",
      stripe_secret_key: "sk",
    });
    expect(starterOnly).not.toContain("create_checkout");

    const proConnected = resolveEnabledToolsForOrg({
      subscription_plan: "professional",
      cal_status: "active",
      cal_api_key: "x",
      cal_event_type_id: "1",
      stripe_status: "active",
      stripe_secret_key: "sk",
    });
    expect(proConnected).toContain("create_checkout");
    expect(proConnected).toContain("book_calendar_appointment");
  });

  it("maps stripe price id to plan", () => {
    const starterPrice = getStripePriceId("starter");
    expect(planFromStripePriceId(starterPrice)).toBe("starter");
  });
});
