import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAppUrl,
  getAuthCallbackUrl,
  getPasswordResetRedirectUrl,
  PRODUCTION_APP_URL,
} from "@/lib/app-url";

describe("app-url", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    process.env = env;
  });

  it("defaults app URL to localhost", () => {
    expect(getAppUrl()).toBe("http://localhost:3000");
  });

  it("falls back when NEXT_PUBLIC_APP_URL is blank", () => {
    process.env.NEXT_PUBLIC_APP_URL = "   ";
    expect(getAppUrl()).toBe("http://localhost:3000");
  });

  it("exposes the production custom domain", () => {
    expect(PRODUCTION_APP_URL).toBe("https://inboxy.braxentech.com");
  });

  it("uses NEXT_PUBLIC_APP_URL when set", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://inboxy.braxentech.com";
    expect(getAppUrl()).toBe("https://inboxy.braxentech.com");
  });

  it("builds auth callback URL from app URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://inboxy.braxentech.com";
    expect(getAuthCallbackUrl()).toBe("https://inboxy.braxentech.com/auth/callback");
  });

  it("builds password reset redirect through auth callback", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://inboxy.braxentech.com";
    expect(getPasswordResetRedirectUrl()).toBe(
      "https://inboxy.braxentech.com/auth/callback?next=%2Freset-password",
    );
  });
});
