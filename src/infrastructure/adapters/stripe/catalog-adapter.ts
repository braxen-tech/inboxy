import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogError, Product, ProductCatalog, RecurringInterval } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { getStripe } from "./client";

const INTERVALS = new Set(["day", "week", "month", "year"]);

function toRecurring(r: Stripe.Price.Recurring | null): RecurringInterval | null {
  if (!r || !INTERVALS.has(r.interval)) return null;
  return { interval: r.interval as RecurringInterval["interval"], intervalCount: r.interval_count };
}

function mapProduct(p: Stripe.Product): Product {
  const price = typeof p.default_price === "object" && p.default_price ? p.default_price : null;
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    images: p.images ?? [],
    defaultPrice:
      price && price.unit_amount != null
        ? {
            id: price.id,
            unitAmount: price.unit_amount,
            currency: price.currency,
            recurring: toRecurring(price.recurring),
          }
        : null,
    active: p.active,
    metadata: p.metadata ?? {},
  };
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function mapStripeError(err: unknown): CatalogError {
  const e = err as { type?: string; statusCode?: number; message?: string };
  if (e?.statusCode === 401 || e?.statusCode === 403 || e?.type === "StripePermissionError") {
    return { code: "AUTH_FAILED", message: e.message ?? "Sem acesso à conta Stripe." };
  }
  if (e?.statusCode === 429) return { code: "RATE_LIMITED", message: e.message ?? "Rate limited" };
  return { code: "PROVIDER_ERROR", message: e?.message ?? String(err) };
}

/**
 * Catalog read from the organization's connected Stripe account.
 * The key passed by the tools is the organization ID.
 */
export class StripeCatalogAdapter implements ProductCatalog {
  constructor(
    private db: SupabaseClient,
    private stripe: () => Stripe = getStripe,
  ) {}

  private async connectedAccount(orgId: string): Promise<string | null> {
    const { data } = await this.db
      .from("organizations")
      .select("stripe_account_id")
      .eq("id", orgId)
      .maybeSingle();
    return (data?.stripe_account_id as string | null) ?? null;
  }

  async listProducts(orgId: string, opts?: { query?: string; limit?: number }): Promise<Result<Product[], CatalogError>> {
    const account = await this.connectedAccount(orgId);
    if (!account) return Err({ code: "AUTH_FAILED", message: "Stripe não conectado." });

    try {
      const res = await this.stripe().products.list(
        { active: true, limit: 100, expand: ["data.default_price"] },
        { stripeAccount: account },
      );
      let products = res.data.map(mapProduct).filter((p) => p.defaultPrice);
      if (opts?.query?.trim()) {
        const q = normalize(opts.query.trim());
        products = products.filter((p) =>
          normalize(`${p.name} ${p.description ?? ""}`).includes(q),
        );
      }
      return Ok(products.slice(0, opts?.limit ?? 20));
    } catch (err) {
      return Err(mapStripeError(err));
    }
  }

  async getProduct(orgId: string, productId: string): Promise<Result<Product, CatalogError>> {
    const account = await this.connectedAccount(orgId);
    if (!account) return Err({ code: "AUTH_FAILED", message: "Stripe não conectado." });

    try {
      const p = await this.stripe().products.retrieve(
        productId,
        { expand: ["default_price"] },
        { stripeAccount: account },
      );
      if (!p.active) return Err({ code: "PROVIDER_ERROR", message: "Produto não encontrado." });
      return Ok(mapProduct(p));
    } catch (err) {
      return Err(mapStripeError(err));
    }
  }
}
