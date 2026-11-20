import { describe, it, expect, vi } from "vitest";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { StripeCatalogAdapter } from "@/infrastructure/adapters/stripe/catalog-adapter";

function dbWithAccount(account: string | null): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { stripe_account_id: account } }) }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const fibra = {
  id: "prod_fibra",
  name: "Fibra 1GB",
  description: "Internet fibra óptica",
  images: [],
  active: true,
  metadata: {},
  default_price: { id: "price_1", unit_amount: 12990, currency: "brl", recurring: { interval: "month" } },
};
const instalacao = {
  id: "prod_inst",
  name: "Taxa de instalação",
  description: null,
  images: [],
  active: true,
  metadata: {},
  default_price: { id: "price_2", unit_amount: 9900, currency: "brl", recurring: null },
};
const semPreco = { ...instalacao, id: "prod_x", name: "Sem preço", default_price: null };

function fakeStripe() {
  const list = vi.fn(async () => ({ data: [fibra, instalacao, semPreco] }));
  const retrieve = vi.fn(async (id: string) => (id === "prod_fibra" ? fibra : { ...fibra, id, active: false }));
  const stripe = { products: { list, retrieve } } as unknown as Stripe;
  return { stripe, list, retrieve };
}

describe("StripeCatalogAdapter", () => {
  it("lists priced products from the org's connected account", async () => {
    const { stripe, list } = fakeStripe();
    const adapter = new StripeCatalogAdapter(dbWithAccount("acct_org"), () => stripe);

    const result = await adapter.listProducts("org-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((p) => p.id)).toEqual(["prod_fibra", "prod_inst"]);
    expect(result.value[0].defaultPrice).toEqual({
      id: "price_1",
      unitAmount: 12990,
      currency: "brl",
      recurring: { interval: "month" },
    });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ active: true }), { stripeAccount: "acct_org" });
  });

  it("filters by query ignoring accents and case", async () => {
    const { stripe } = fakeStripe();
    const adapter = new StripeCatalogAdapter(dbWithAccount("acct_org"), () => stripe);

    const result = await adapter.listProducts("org-1", { query: "INSTALACAO" });

    expect(result.ok && result.value.map((p) => p.id)).toEqual(["prod_inst"]);
  });

  it("fails when the org has no connected Stripe account", async () => {
    const { stripe, list } = fakeStripe();
    const adapter = new StripeCatalogAdapter(dbWithAccount(null), () => stripe);

    const result = await adapter.listProducts("org-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("AUTH_FAILED");
    expect(list).not.toHaveBeenCalled();
  });

  it("gets an active product and rejects archived ones", async () => {
    const { stripe, retrieve } = fakeStripe();
    const adapter = new StripeCatalogAdapter(dbWithAccount("acct_org"), () => stripe);

    const ok = await adapter.getProduct("org-1", "prod_fibra");
    expect(ok.ok && ok.value.name).toBe("Fibra 1GB");
    expect(retrieve).toHaveBeenCalledWith("prod_fibra", { expand: ["default_price"] }, { stripeAccount: "acct_org" });

    const archived = await adapter.getProduct("org-1", "prod_old");
    expect(archived.ok).toBe(false);
  });
});
