import { describe, expect, it } from "vitest";
import {
  INBOXY_AGENT_BOT_NAME,
  sanitizeAgentBotName,
} from "@/lib/chatwoot-agent-bot";

describe("sanitizeAgentBotName", () => {
  it("uses a generic product name instead of the org owner name", () => {
    expect(sanitizeAgentBotName("Tiago Rocha")).toBe(INBOXY_AGENT_BOT_NAME);
    expect(sanitizeAgentBotName("Tiago Rocha")).toBe("Assistente Inboxy");
    expect(sanitizeAgentBotName("")).toBe("Assistente Inboxy");
  });
});
