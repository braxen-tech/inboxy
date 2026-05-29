import type { ProductCatalog, Product, Price, CatalogError } from "@/domain/ports";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { createStripeClient } from "./client";
import type Stripe from "stripe";

const DEFAULT_LIMIT = 10;

export class StripeCatalogAdapter implements ProductCatalog {
  async listProducts(
    apiKey: string,
    opts?: { query?: string; limit?: number },
  ): Promise<Result<Product[], CatalogError>> {
    try {
      const stripe = createStripeClient(apiKey);
      const limit = Math.min(opts?.limit ?? DEFAULT_LIMIT, 100);

      let products: Stripe.Product[];

      if (opts?.query) {
        const response = await stripe.products.search({
          query: `active:'true' AND name~'${opts.query}'`,
          limit,
          expand: ["data.default_price"],
        });
        products = response.data;
      } else {
        const response = await stripe.products.list({
          active: true,
          limit,
          expand: ["data.default_price"],
        });
        products = response.data;
      }

      return Ok(products.map(mapProduct));
    } catch (error) {
      return Err(mapError(error));
    }
  }

  async getProduct(
    apiKey: string,
    productId: string,
  ): Promise<Result<Product, CatalogError>> {
    try {
      const stripe = createStripeClient(apiKey);
      const product = await stripe.products.retrieve(productId, {
        expand: ["default_price"],
      });

      if (!product.active) {
        return Err({ code: "PROVIDER_ERROR", message: "Produto não encontrado ou inativo." });
      }

      return Ok(mapProduct(product));
    } catch (error) {
      return Err(mapError(error));
    }
  }
}

function mapProduct(p: Stripe.Product): Product {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    images: p.images,
    defaultPrice: p.default_price && typeof p.default_price === "object"
      ? mapPrice(p.default_price as Stripe.Price)
      : null,
    active: p.active,
    metadata: p.metadata as Record<string, string>,
  };
}

function mapPrice(p: Stripe.Price): Price {
  return {
    id: p.id,
    unitAmount: p.unit_amount ?? 0,
    currency: p.currency,
    recurring: p.recurring ? { interval: p.recurring.interval } : null,
  };
}

function mapError(error: unknown): CatalogError {
  if (error && typeof error === "object" && "type" in error) {
    const stripeErr = error as { type: string; message?: string; statusCode?: number };
    if (stripeErr.type === "StripeAuthenticationError") {
      return { code: "AUTH_FAILED", message: "Chave da API do Stripe inválida ou expirada." };
    }
    if (stripeErr.type === "StripeRateLimitError") {
      return { code: "RATE_LIMITED", message: "Limite de requisições atingido. Tente novamente em instantes." };
    }
    return { code: "PROVIDER_ERROR", message: stripeErr.message ?? "Erro ao consultar catálogo." };
  }
  return { code: "PROVIDER_ERROR", message: "Erro inesperado ao consultar catálogo." };
}
