import type { DocumentTextExtractor } from "@/domain/ports/document-text-extractor";
import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import { extractCsvText } from "./csv";
import { extractDocxText } from "./docx";
import { extractPdfText } from "./pdf";
import { extractPlainText } from "./plain";

export class CompositeDocumentTextExtractor implements DocumentTextExtractor {
  async extract(
    buffer: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<Result<string, import("@/domain/ports/document-text-extractor").ExtractError>> {
    const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";

    if (normalized === "application/pdf") {
      return extractPdfText(buffer);
    }
    if (normalized === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return extractDocxText(buffer);
    }
    if (normalized === "text/csv" || normalized === "application/csv") {
      return extractCsvText(buffer);
    }
    if (normalized === "text/plain" || normalized === "text/markdown") {
      return extractPlainText(buffer);
    }

    const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
    if (ext === ".pdf") return extractPdfText(buffer);
    if (ext === ".docx") return extractDocxText(buffer);
    if (ext === ".csv") return extractCsvText(buffer);
    if (ext === ".txt" || ext === ".md") return extractPlainText(buffer);

    return Err({
      code: "UNSUPPORTED",
      message: "Tipo de arquivo não suportado. Use PDF, DOCX, TXT, MD ou CSV.",
    });
  }
}

export const documentTextExtractor = new CompositeDocumentTextExtractor();
