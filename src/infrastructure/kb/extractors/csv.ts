import type { Result } from "@/domain/errors";
import { Ok, Err } from "@/domain/errors";
import type { ExtractError } from "@/domain/ports/document-text-extractor";
import Papa from "papaparse";

export async function extractCsvText(buffer: Buffer): Promise<Result<string, ExtractError>> {
  try {
    const raw = buffer.toString("utf-8");
    const parsed = Papa.parse<Record<string, string>>(raw, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
      return Err({
        code: "EXTRACT_FAILED",
        message: "CSV inválido ou vazio.",
      });
    }

    const rows = parsed.data ?? [];
    if (rows.length === 0) {
      const fallback = Papa.parse<string[]>(raw, { skipEmptyLines: true });
      const lines = (fallback.data as string[][]).map((cells) => cells.join(" | "));
      const text = lines.join("\n").trim();
      if (!text) {
        return Err({ code: "EXTRACT_FAILED", message: "CSV vazio." });
      }
      return Ok(text);
    }

    const lines = rows.map((row, index) => {
      const pairs = Object.entries(row)
        .filter(([, value]) => value != null && String(value).trim() !== "")
        .map(([key, value]) => `${key}: ${value}`);
      return `Linha ${index + 1}: ${pairs.join("; ")}`;
    });

    return Ok(lines.join("\n"));
  } catch (err) {
    return Err({
      code: "EXTRACT_FAILED",
      message: err instanceof Error ? err.message : "Falha ao extrair texto do CSV.",
    });
  }
}
