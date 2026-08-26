import type { ProductCatalog, Product, CatalogError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

interface StoreBlock {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  price_brl: number | null;
  price_display: string | null;
  payment_type: string | null;
  billing_cycle: string | null;
  external_url: string | null;
  visible: boolean;
}

function mapBlock(b: StoreBlock): Product {
  const priceAmountCents = b.price_brl ? Math.round(b.price_brl * 100) : 0;
  return {
    id: b.id,
    name: b.title ?? "Produto sem nome",
    description: b.description,
    images: b.image_url ? [b.image_url] : [],
    defaultPrice: priceAmountCents > 0
      ? {
          id: b.id,
          unitAmount: priceAmountCents,
          currency: "brl",
          recurring: b.payment_type === "recurring" && b.billing_cycle
            ? { interval: b.billing_cycle }
            : null,
        }
      : null,
    active: b.visible,
    metadata: b.price_display ? { price_display: b.price_display } : {},
  };
}

/**
 * Product catalog backed by store_blocks in Supabase.
 * The `key` parameter is the organization ID used to scope the query.
 */
export class AsaasDbCatalogAdapter implements ProductCatalog {
  constructor(private db: SupabaseClient) {}

  async listProducts(orgId: string, opts?: { query?: string; limit?: number }): Promise<Result<Product[], CatalogError>> {
    try {
      let query = this.db
        .from("store_blocks")
        .select("id, title, description, image_url, price_brl, price_display, payment_type, billing_cycle, external_url, visible")
        .eq("organization_id", orgId)
        .eq("type", "product")
        .eq("visible", true)
        .order("position", { ascending: true })
        .limit(opts?.limit ?? 20);

      if (opts?.query) {
        query = query.ilike("title", `%${opts.query}%`);
      }

      const { data, error } = await query;

      if (error) {
        return Err({ code: "PROVIDER_ERROR", message: error.message });
      }

      return Ok((data ?? []).map((b) => mapBlock(b as StoreBlock)));
    } catch (error) {
      return Err({ code: "PROVIDER_ERROR", message: String(error) });
    }
  }

  async getProduct(orgId: string, productId: string): Promise<Result<Product, CatalogError>> {
    try {
      const { data, error } = await this.db
        .from("store_blocks")
        .select("id, title, description, image_url, price_brl, price_display, payment_type, billing_cycle, external_url, visible")
        .eq("organization_id", orgId)
        .eq("id", productId)
        .eq("type", "product")
        .maybeSingle();

      if (error) {
        return Err({ code: "PROVIDER_ERROR", message: error.message });
      }

      if (!data) {
        return Err({ code: "PROVIDER_ERROR", message: "Produto não encontrado." });
      }

      return Ok(mapBlock(data as StoreBlock));
    } catch (error) {
      return Err({ code: "PROVIDER_ERROR", message: String(error) });
    }
  }
}
