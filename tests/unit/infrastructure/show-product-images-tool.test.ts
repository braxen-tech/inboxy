import { describe, it, expect, vi } from "vitest";
import { ShowProductImagesTool } from "@/infrastructure/tools/stripe/show-product-images";
import { Ok, Err } from "@/domain/errors";
import type { ProductCatalog, ToolContext } from "@/domain/ports";
import type { OrgId } from "@/domain/value-objects";

const mockSendAttachment = vi.fn().mockResolvedValue({ ok: true, data: { id: 1 } });

vi.mock("@/infrastructure/adapters/chatwoot/client", () => {
  return {
    ChatwootClient: class {
      sendMessageWithAttachment = mockSendAttachment;
    },
  };
});

function makeCtx(overrides?: Partial<ToolContext>): ToolContext {
  return {
    orgId: "org-1" as OrgId,
    contactPhone: "+5511999999999",
    conversationId: "conv-1",
    stripe: { apiKey: "sk_test_xxx" },
    chatwoot: {
      apiUrl: "https://chatwoot.example.com",
      apiToken: "token-123",
      accountId: "1",
      conversationId: 42,
    },
    ...overrides,
  };
}

function makeMockCatalog(images: string[] = ["https://img.stripe.com/product1.jpg"]): ProductCatalog {
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
  it("returns error when stripe context is missing", async () => {
    const catalog = makeMockCatalog();
    const tool = new ShowProductImagesTool(catalog);
    const ctx = makeCtx({ stripe: undefined });

    const result = await tool.execute(ctx, { productId: "prod_123" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("EXECUTION_FAILED");
  });

  it("returns error when chatwoot context is missing", async () => {
    const catalog = makeMockCatalog();
    const tool = new ShowProductImagesTool(catalog);
    const ctx = makeCtx({ chatwoot: undefined });

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

  it("sends images and returns success count", async () => {
    const images = ["https://img.stripe.com/a.jpg", "https://img.stripe.com/b.jpg"];
    const catalog = makeMockCatalog(images);
    const tool = new ShowProductImagesTool(catalog);
    const ctx = makeCtx();

    const result = await tool.execute(ctx, { productId: "prod_123" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("2 imagem(ns)");
      expect(result.value).toContain("Camiseta Azul");
    }
  });

  it("forwards caption on first image", async () => {
    mockSendAttachment.mockClear();

    const catalog = makeMockCatalog(["https://img.stripe.com/a.jpg"]);
    const tool = new ShowProductImagesTool(catalog);
    const ctx = makeCtx();

    await tool.execute(ctx, { productId: "prod_123", caption: "Confira!" });

    expect(mockSendAttachment).toHaveBeenCalledWith(
      "1",
      42,
      "Confira!",
      "https://img.stripe.com/a.jpg",
    );
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
