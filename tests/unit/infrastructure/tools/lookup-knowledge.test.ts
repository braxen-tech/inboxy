import { describe, it, expect, vi } from "vitest";
import { z } from "zod/v4";
import { LookupKnowledgeTool } from "@/infrastructure/tools/lookup-knowledge";
import { toOrgId } from "@/domain/value-objects";
import { Ok } from "@/domain/errors";
import type { KnowledgeRetriever } from "@/domain/ports/knowledge-retriever";

describe("LookupKnowledgeTool", () => {
  it("returns formatted chunks on success", async () => {
    const retriever: KnowledgeRetriever = {
      retrieve: vi.fn().mockResolvedValue(
        Ok([
          {
            content: "Horário: 8h às 18h",
            score: 0.92,
            documentTitle: "manual.pdf",
          },
        ]),
      ),
    };

    const tool = new LookupKnowledgeTool(retriever);
    const result = await tool.execute(
      {
        orgId: toOrgId("org-1"),
        contactPhone: "",
        conversationId: "conv-1",
      },
      { query: "horário de funcionamento" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("manual.pdf");
      expect(result.value).toContain("Horário: 8h às 18h");
    }
  });

  it("validates input schema", async () => {
    const retriever: KnowledgeRetriever = {
      retrieve: vi.fn(),
    };
    const tool = new LookupKnowledgeTool(retriever);
    const result = await tool.execute(
      {
        orgId: toOrgId("org-1"),
        contactPhone: "",
        conversationId: "conv-1",
      },
      { query: "" },
    );

    expect(result.ok).toBe(false);
    expect(z.object({ query: z.string().min(1) }).safeParse({ query: "" }).success).toBe(false);
  });
});
