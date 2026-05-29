import type { Result } from "../errors";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  defaultPrice: Price | null;
  active: boolean;
  metadata: Record<string, string>;
}

export interface Price {
  id: string;
  unitAmount: number;
  currency: string;
  recurring: null | { interval: string };
}

export type CatalogError = {
  code: "AUTH_FAILED" | "RATE_LIMITED" | "PROVIDER_ERROR";
  message: string;
};

export interface ProductCatalog {
  listProducts(apiKey: string, opts?: { query?: string; limit?: number }): Promise<Result<Product[], CatalogError>>;
  getProduct(apiKey: string, productId: string): Promise<Result<Product, CatalogError>>;
}
