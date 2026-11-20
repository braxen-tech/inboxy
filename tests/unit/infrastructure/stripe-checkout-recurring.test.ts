import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("@/infrastructure/adapters/stripe/client", () => ({
  getStripe: () => ({ checkout: { sessions: { create } } }),
}));

import { StripePaymentAdapter } from "@/infrastructure/adapters/stripe/payment-adapter";
import { formatPrice, parseBrl } from "@/app/(dashboard)/[orgSlug]/catalog/catalog-manager";

describe("StripePaymentAdapter recurring items", () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ id: "cs_1", url: "https://checkout.test" });
  });

  it("runs in subscription mode with the item's own interval", async () => {
    await new StripePaymentAdapter().createCheckoutSession({
      stripeAccountId: "acct_org",
      metadata: {},
      lineItems: [
        { productId: "prod_a", productName: "Fibra", quantity: 1, unitAmountBrl: 129.9, recurring: { interval: "month", intervalCount: 3 } },
        { productId: "prod_b", productName: "Instalação", quantity: 1, unitAmountBrl: 99 },
      ],
    });

    const params = create.mock.calls[0][0];
    expect(params.mode).toBe("subscription");
    expect(params.line_items[0].price_data.recurring).toEqual({ interval: "month", interval_count: 3 });
    expect(params.line_items[1].price_data.recurring).toBeUndefined();
    expect(params.subscription_data.transfer_data).toEqual({ destination: "acct_org" });
  });

  it("stays a one-time payment when no item is recurring", async () => {
    await new StripePaymentAdapter().createCheckoutSession({
      stripeAccountId: "acct_org",
      metadata: {},
      lineItems: [{ productId: "prod_b", productName: "Roteador", quantity: 1, unitAmountBrl: 249 }],
    });

    const params = create.mock.calls[0][0];
    expect(params.mode).toBe("payment");
    expect(params.line_items[0].price_data.recurring).toBeUndefined();
  });
});

describe("catalog price helpers", () => {
  it("parses Brazilian amounts", () => {
    expect(parseBrl("129,90")).toBe(129.9);
    expect(parseBrl("R$ 1.299,90")).toBe(1299.9);
    expect(parseBrl("249")).toBe(249);
    expect(parseBrl("abc")).toBeNull();
    expect(parseBrl("0")).toBeNull();
  });

  it("formats with the billing period", () => {
    expect(formatPrice(12990, "monthly")).toMatch(/129,90 \/ mês$/);
    expect(formatPrice(9900, "one_time")).toMatch(/99,00$/);
  });
});
