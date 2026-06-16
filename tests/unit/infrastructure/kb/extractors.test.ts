import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPlainText } from "@/infrastructure/kb/extractors/plain";
import { extractCsvText } from "@/infrastructure/kb/extractors/csv";
import { extractPdfText } from "@/infrastructure/kb/extractors/pdf";
import { CompositeDocumentTextExtractor } from "@/infrastructure/kb/extractors";

describe("document extractors", () => {
  it("extracts plain text", async () => {
    const result = await extractPlainText(Buffer.from("# Título\n\nConteúdo", "utf-8"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("Conteúdo");
    }
  });

  it("extracts csv as readable lines", async () => {
    const csv = "nome,preco\nProduto A,10\nProduto B,20";
    const result = await extractCsvText(Buffer.from(csv, "utf-8"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("Produto A");
      expect(result.value).toContain("preco: 10");
    }
  });

  it("extracts text from pdf fixture", async () => {
    const fixturePath = join(process.cwd(), "fixtures/clinica-vida-plena-manual.pdf");
    const buffer = readFileSync(fixturePath);
    const result = await extractPdfText(buffer);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("Clinica Vida Plena");
    }
  });

  it("rejects unsupported mime types", async () => {
    const extractor = new CompositeDocumentTextExtractor();
    const result = await extractor.extract(
      Buffer.from("fake"),
      "image/png",
      "photo.png",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED");
    }
  });
});
