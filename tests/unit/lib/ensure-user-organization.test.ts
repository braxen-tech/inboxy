import { describe, expect, it } from "vitest";
import { slugFromEmail } from "@/lib/ensure-user-organization";

describe("slugFromEmail", () => {
  it("derives a slug from the email local part", () => {
    expect(slugFromEmail("contact@braxentech.com")).toBe("contact");
  });

  it("normalizes invalid characters", () => {
    expect(slugFromEmail("João Silva+tag@example.com")).toBe("jo-o-silva-tag");
  });

  it("falls back when local part is too short", () => {
    expect(slugFromEmail("a@example.com")).toBe("org");
  });
});
