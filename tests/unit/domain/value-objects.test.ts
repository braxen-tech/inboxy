import { describe, it, expect } from "vitest";
import { toOrgId, toPhoneNumber, toCorrelationId } from "@/domain/value-objects";

describe("Value Objects", () => {
  it("toOrgId brands a string", () => {
    const id = toOrgId("abc-123");
    expect(id).toBe("abc-123");
  });

  it("toPhoneNumber brands a string", () => {
    const phone = toPhoneNumber("5511999990000");
    expect(phone).toBe("5511999990000");
  });

  it("toCorrelationId brands a string", () => {
    const cid = toCorrelationId("corr-1");
    expect(cid).toBe("corr-1");
  });
});
