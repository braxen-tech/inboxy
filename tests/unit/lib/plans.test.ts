import { describe, it, expect } from "vitest";
import {
  PLANS,
  LOOKUP_KNOWLEDGE_TOOL,
  CHATWOOT_HANDOFF_TOOL,
  CHATWOOT_LABEL_TOOL,
  CHATWOOT_CONTACT_TOOL,
  resolveAllowedTools,
  resolveEnabledToolsForOrg,
} from "@/lib/plans";

describe("plans", () => {
  it("starter has no integrations", () => {
    expect(PLANS.starter.allowedIntegrations).toEqual([]);
    expect(resolveAllowedTools([])).toEqual([]);
  });

  it("professional resolves cal and store tools", () => {
    const tools = resolveAllowedTools(PLANS.professional.allowedIntegrations);
    expect(tools).toContain("check_calendar_availability");
    expect(tools).toContain("create_checkout");
  });

  it("resolveEnabledToolsForOrg gates by plan and connection", () => {
    const starterOnly = resolveEnabledToolsForOrg({
      subscription_plan: "starter",
      cal_managed_user_id: 1,
      cal_access_token_enc: "x",
      cal_event_type_id: "1",
      asaas_status: "active",
      asaas_api_key_enc: "enc",
    });
    expect(starterOnly).not.toContain("create_checkout");

    const proConnected = resolveEnabledToolsForOrg({
      subscription_plan: "professional",
      cal_managed_user_id: 1,
      cal_access_token_enc: "x",
      cal_event_type_id: "1",
      asaas_status: "active",
      asaas_api_key_enc: "enc",
    });
    expect(proConnected).toContain("create_checkout");
    expect(proConnected).toContain("book_calendar_appointment");
  });

  it("includes transfer_to_human when Chatwoot is active", () => {
    const tools = resolveEnabledToolsForOrg({
      subscription_plan: "starter",
      chatwoot_status: "active",
      chatwoot_api_token: "tok",
      chatwoot_account_id: "1",
    });
    expect(tools).toContain(CHATWOOT_HANDOFF_TOOL);
    expect(tools).toContain(CHATWOOT_LABEL_TOOL);
    expect(tools).toContain(CHATWOOT_CONTACT_TOOL);
  });

  it("includes lookup_knowledge when org has indexed documents", () => {
    const tools = resolveEnabledToolsForOrg({
      subscription_plan: "starter",
      hasKbDocuments: true,
    });
    expect(tools).toContain(LOOKUP_KNOWLEDGE_TOOL);
  });
});
