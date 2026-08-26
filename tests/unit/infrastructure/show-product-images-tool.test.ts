import { describe, it, expect, vi } from "vitest";
import { ShowProductImagesTool } from "@/infrastructure/tools/stripe/show-product-images";
import { Ok, Err } from "@/domain/errors";
import type { ProductCatalog, ToolContext } from "@/domain/ports";
import type { OrgId } from "@/domain/value-objects";

function makeCtx(overrides?: Partial<ToolContext>): ToolContext {
  return {
    orgId: "org-1" as OrgId,
    contactPhone: "+5511999999999",
    conversationId: "conv-1",
    asaas: { apiKey: "asaas-key-xxx" },
    ...overrides,
  };
}

function makeMockCatalog(images: string[] = ["https://storage.example.com/product1.jpg"]): ProductCatalog {
  return {
    listProducts: vi.fn(),
    getProduct: vi.fn().mockResolvedValue(
      Ok({
        id: "prod_123",
        name: "Camiseta Azul",
        description: "Uma camiseta azul",
        images,
        defaultPrice: { id: "price_1", unitAmount: 9990, currency: "brl", recurring: null },
        active: true,
        metadata: {},
      }),
    ),
  };
}

describe("ShowProductImagesTool", () => {
  it("returns error when asaas context is missing", async () => {
    const catalog = makeMockCatalog();
    const tool = new ShowProductImagesTool(catalog);
    const ctx = makeCtx({ asaas: undefined });

    const result = await tool.execute(ctx, { productId: "prod_123" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("EXECUTION_FAILED");
  });

  it("returns validation error when productId is missing", async () => {
    const catalog = makeMockCatalog();
    const tool = new ShowProductImagesTool(catalog);
    const ctx = makeCtx();

    const result = await tool.execute(ctx, {});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_FAILED");
  });

  it("returns message when product has no images", async () => {
    const catalog = makeMockCatalog([]);
    const tool = new ShowProductImagesTool(catalog);
    const ctx = makeCtx();

    const result = await tool.execute(ctx, { productId: "prod_123" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain("não possui imagens");
  });

  it("returns image URLs and product name", async () => {
    const images = ["https://storage.example.com/a.jpg", "https://storage.example.com/b.jpg"];
    const catalog = makeMockCatalog(images);
    const tool = new ShowProductImagesTool(catalog);
    const ctx = makeCtx();

    const result = await tool.execute(ctx, { productId: "prod_123" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("Camiseta Azul");
      expect(result.value).toContain("https://storage.example.com/a.jpg");
    }
  });

  it("includes caption when provided", async () => {
    const catalog = makeMockCatalog(["https://storage.example.com/a.jpg"]);
    const tool = new ShowProductImagesTool(catalog);
    const ctx = makeCtx();

    const result = await tool.execute(ctx, { productId: "prod_123", caption: "Confira!" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain("Confira!");
  });

  it("returns error when catalog auth fails", async () => {
    const catalog: ProductCatalog = {
      listProducts: vi.fn(),
      getProduct: vi.fn().mockResolvedValue(
        Err({ code: "AUTH_FAILED", message: "Invalid key" }),
      ),
    };
    const tool = new ShowProductImagesTool(catalog);
    const ctx = makeCtx();

    const result = await tool.execute(ctx, { productId: "prod_123" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EXECUTION_FAILED");
      expect(result.error.message).toContain("expirada");
    }
  });
});
