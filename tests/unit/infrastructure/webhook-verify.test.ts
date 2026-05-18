import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifySignature } from "@/infrastructure/adapters/whatsapp-cloud/webhook";

describe("Webhook signature verification", () => {
  const appSecret = "test_app_secret_123";

  function sign(body: string): string {
    const hash = createHmac("sha256", appSecret).update(body).digest("hex");
    return `sha256=${hash}`;
  }

  it("accepts valid signature", () => {
    const body = JSON.stringify({ test: true });
    const signature = sign(body);
    expect(verifySignature(body, signature, appSecret)).toBe(true);
  });

  it("rejects invalid signature", () => {
    const body = JSON.stringify({ test: true });
    expect(verifySignature(body, "sha256=invalid", appSecret)).toBe(false);
  });

  it("rejects null signature", () => {
    const body = JSON.stringify({ test: true });
    expect(verifySignature(body, null, appSecret)).toBe(false);
  });

  it("rejects tampered body", () => {
    const body = JSON.stringify({ test: true });
    const signature = sign(body);
    const tamperedBody = JSON.stringify({ test: false });
    expect(verifySignature(tamperedBody, signature, appSecret)).toBe(false);
  });
});
