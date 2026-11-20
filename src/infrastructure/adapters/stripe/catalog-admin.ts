import type Stripe from "stripe";
import { getStripe } from "./client";

export const BILLING_OPTIONS = ["one_time", "weekly", "monthly", "quarterly", "semiannual", "yearly"] as const;
export type BillingOption = (typeof BILLING_OPTIONS)[number];

const RECURRENCE: Record<Exclude<BillingOption, "one_time">, { interval: "week" | "month" | "year"; interval_count: number }> = {
  weekly: { interval: "week", interval_count: 1 },
  monthly: { interval: "month", interval_count: 1 },
  quarterly: { interval: "month", interval_count: 3 },
  semiannual: { interval: "month", interval_count: 6 },
  yearly: { interval: "year", interval_count: 1 },
};

export function recurrenceFor(billing: BillingOption) {
  return billing === "one_time" ? undefined : RECURRENCE[billing];
}

/** Maps a Stripe recurrence back to an option; prices created elsewhere may not match one ("custom"). */
export function billingFromRecurring(r: Stripe.Price.Recurring | null): BillingOption | "custom" {
  if (!r) return "one_time";
  const hit = (Object.entries(RECURRENCE) as [BillingOption, (typeof RECURRENCE)["monthly"]][]).find(
    ([, v]) => v.interval === r.interval && v.interval_count === r.interval_count,
  );
  return hit ? hit[0] : "custom";
}

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  priceId: string | null;
  amountCents: number | null;
  billing: BillingOption | "custom";
}

export interface CatalogInput {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  amountCents: number;
  billing: BillingOption;
}

type StripeFactory = () => Stripe;

function toItem(p: Stripe.Product): CatalogItem {
  const price = typeof p.default_price === "object" && p.default_price ? p.default_price : null;
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    imageUrl: p.images?.[0] ?? null,
    active: p.active,
    priceId: price?.id ?? null,
    amountCents: price?.unit_amount ?? null,
    billing: billingFromRecurring(price?.recurring ?? null),
  };
}

export async function listCatalogItems(account: string, stripe: StripeFactory = getStripe): Promise<CatalogItem[]> {
  const items: CatalogItem[] = [];
  for await (const p of stripe().products.list(
    { limit: 100, expand: ["data.default_price"] },
    { stripeAccount: account },
  )) {
    items.push(toItem(p));
    if (items.length >= 500) break;
  }
  return items.sort((a, b) => Number(b.active) - Number(a.active));
}

export async function createCatalogItem(
  account: string,
  input: CatalogInput,
  stripe: StripeFactory = getStripe,
): Promise<CatalogItem> {
  const recurring = recurrenceFor(input.billing);
  const product = await stripe().products.create(
    {
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      ...(input.imageUrl ? { images: [input.imageUrl] } : {}),
      default_price_data: {
        currency: "brl",
        unit_amount: input.amountCents,
        ...(recurring ? { recurring } : {}),
      },
      expand: ["default_price"],
    },
    { stripeAccount: account },
  );
  return toItem(product);
}

/** Stripe prices are immutable: a new amount or recurrence creates a new default price and archives the old one. */
export async function updateCatalogItem(
  account: string,
  productId: string,
  input: CatalogInput,
  stripe: StripeFactory = getStripe,
): Promise<CatalogItem> {
  const opts = { stripeAccount: account };
  const current = toItem(await stripe().products.retrieve(productId, { expand: ["default_price"] }, opts));

  let newPriceId: string | null = null;
  if (current.amountCents !== input.amountCents || current.billing !== input.billing) {
    const recurring = recurrenceFor(input.billing);
    const price = await stripe().prices.create(
      {
        product: productId,
        currency: "brl",
        unit_amount: input.amountCents,
        ...(recurring ? { recurring } : {}),
      },
      opts,
    );
    newPriceId = price.id;
  }

  const updated = await stripe().products.update(
    productId,
    {
      name: input.name,
      description: input.description || "",
      images: input.imageUrl ? [input.imageUrl] : [],
      ...(newPriceId ? { default_price: newPriceId } : {}),
      expand: ["default_price"],
    },
    opts,
  );

  if (newPriceId && current.priceId) {
    await stripe().prices.update(current.priceId, { active: false }, opts);
  }
  return toItem(updated);
}

export async function setCatalogItemActive(
  account: string,
  productId: string,
  active: boolean,
  stripe: StripeFactory = getStripe,
): Promise<void> {
  await stripe().products.update(productId, { active }, { stripeAccount: account });
}
