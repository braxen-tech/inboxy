import { describe, expect, it } from "vitest";
import {
  AUTH_PUBLIC_PATH_PREFIXES,
  AUTH_RESERVED_SLUGS,
  getAuthCallbackRedirectTarget,
  isAuthPublicPath,
  isReservedAppSlug,
} from "@/lib/auth-routes";

describe("auth-routes", () => {
  it("exposes password recovery routes as public and reserved", () => {
    expect(AUTH_PUBLIC_PATH_PREFIXES).toContain("/forgot-password");
    expect(AUTH_RESERVED_SLUGS.has("forgot-password")).toBe(true);
    expect(AUTH_RESERVED_SLUGS.has("reset-password")).toBe(true);
  });

  it("treats forgot-password as a public path", () => {
    expect(isAuthPublicPath("/forgot-password")).toBe(true);
    expect(isAuthPublicPath("/login")).toBe(true);
    expect(isAuthPublicPath("/acme-corp/agent")).toBe(false);
  });

  it("blocks reserved slugs from org routing", () => {
    expect(isReservedAppSlug("reset-password")).toBe(true);
    expect(isReservedAppSlug("minha-empresa")).toBe(false);
  });

  describe("getAuthCallbackRedirectTarget", () => {
    it("defaults to home when next is missing", () => {
      expect(getAuthCallbackRedirectTarget(null)).toBe("/");
    });

    it("allows same-origin relative paths", () => {
      expect(getAuthCallbackRedirectTarget("/reset-password")).toBe("/reset-password");
    });

    it("rejects open redirects", () => {
      expect(getAuthCallbackRedirectTarget("https://evil.example")).toBe("/");
      expect(getAuthCallbackRedirectTarget("//evil.example")).toBe("/");
    });
  });
});
