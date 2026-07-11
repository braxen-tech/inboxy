import { describe, it, expect } from "vitest";
import { normalizeChatwootChannel, parseChatwootChannel } from "@/lib/chatwoot-channel";

describe("parseChatwootChannel", () => {
  it("returns trimmed string for valid channel", () => {
    expect(parseChatwootChannel("Channel::Whatsapp")).toBe("Channel::Whatsapp");
  });

  it("returns null for empty or non-string values", () => {
    expect(parseChatwootChannel("")).toBeNull();
    expect(parseChatwootChannel("   ")).toBeNull();
    expect(parseChatwootChannel(null)).toBeNull();
    expect(parseChatwootChannel(undefined)).toBeNull();
  });
});

describe("normalizeChatwootChannel", () => {
  it("maps known Chatwoot channel types", () => {
    expect(normalizeChatwootChannel("Channel::Whatsapp")).toBe("whatsapp");
    expect(normalizeChatwootChannel("Channel::Telegram")).toBe("telegram");
    expect(normalizeChatwootChannel("Channel::Instagram")).toBe("instagram");
    expect(normalizeChatwootChannel("Channel::FacebookPage")).toBe("messenger");
    expect(normalizeChatwootChannel("Channel::WebWidget")).toBe("web_widget");
  });

  it("slugifies unknown Channel:: types", () => {
    expect(normalizeChatwootChannel("Channel::CustomThing")).toBe("custom_thing");
  });
});
