import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import {
  billingFromRecurring,
  createCatalogItem,
  recurrenceFor,
  updateCatalogItem,
} from "@/infrastructure/adapters/stripe/catalog-admin";

const ACCT = { stripeAccount: "acct_org" };

function product(price: { id: string; unit_amount: number; recurring: unknown }) {
  return {
    id: "prod_1",
    name: "Fibra",
    description: null,
    images: [],
    active: true,
    default_price: price,
  };
}

function fakeStripe(current = product({ id: "price_old", unit_amount: 9900, recurring: null })) {
  const products = {
    create: vi.fn(async (params: { name: string; default_price_data: { unit_amount: number; recurring?: unknown } }) =>
      product({ id: "price_new", unit_amount: params.default_price_data.unit_amount, recurring: params.default_price_data.recurring ?? null }),
    ),
    retrieve: vi.fn(async () => current),
    update: vi.fn(async (_id: string, params: Record<string, unknown>) => ({ ...current, ...params, default_price: current.default_price })),
  };
  const prices = {
    create: vi.fn(async () => ({ id: "price_new" })),
    update: vi.fn(async () => ({})),
  };
  return { stripe: { products, prices } as unknown as Stripe, products, prices };
}

describe("billing options", () => {
  it("maps options to Stripe recurrence and back", () => {
    expect(recurrenceFor("one_time")).toBeUndefined();
    expect(recurrenceFor("quarterly")).toEqual({ interval: "month", interval_count: 3 });
    expect(billingFromRecurring(null)).toBe("one_time");
    expect(billingFromRecurring({ interval: "month", interval_count: 6 } as Stripe.Price.Recurring)).toBe("semiannual");
    expect(billingFromRecurring({ interval: "day", interval_count: 2 } as Stripe.Price.Recurring)).toBe("custom");
  });
});

describe("createCatalogItem", () => {
  it("creates a recurring product in the connected account", async () => {
    const { stripe, products } = fakeStripe();
    await createCatalogItem("acct_org", { name: "Fibra", amountCents: 12990, billing: "monthly" }, () => stripe);

    expect(products.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Fibra",
        default_price_data: { currency: "brl", unit_amount: 12990, recurring: { interval: "month", interval_count: 1 } },
      }),
      ACCT,
    );
  });

  it("creates a one-time product without recurrence", async () => {
    const { stripe, products } = fakeStripe();
    await createCatalogItem("acct_org", { name: "Roteador", amountCents: 24900, billing: "one_time" }, () => stripe);

    expect(products.create.mock.calls[0][0].default_price_data).toEqual({ currency: "brl", unit_amount: 24900 });
  });
});

describe("updateCatalogItem", () => {
  it("creates a new default price and archives the old one when the price changes", async () => {
    const { stripe, products, prices } = fakeStripe();
    await updateCatalogItem("acct_org", "prod_1", { name: "Fibra", amountCents: 12990, billing: "yearly" }, () => stripe);

    expect(prices.create).toHaveBeenCalledWith(
      { product: "prod_1", currency: "brl", unit_amount: 12990, recurring: { interval: "year", interval_count: 1 } },
      ACCT,
    );
    expect(products.update).toHaveBeenCalledWith("prod_1", expect.objectContaining({ default_price: "price_new" }), ACCT);
    expect(prices.update).toHaveBeenCalledWith("price_old", { active: false }, ACCT);
  });

  it("keeps the price when only the name changes", async () => {
    const { stripe, prices, products } = fakeStripe();
    await updateCatalogItem("acct_org", "prod_1", { name: "Fibra Plus", amountCents: 9900, billing: "one_time" }, () => stripe);

    expect(prices.create).not.toHaveBeenCalled();
    expect(prices.update).not.toHaveBeenCalled();
    expect(products.update.mock.calls[0][1]).not.toHaveProperty("default_price");
  });
});
