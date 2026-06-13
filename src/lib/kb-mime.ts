export const KB_BUCKET = "kb-documents";

export const KB_MAX_FILE_BYTES = 10 * 1024 * 1024;

export const KB_ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".csv"] as const;

export const KB_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/csv",
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
};

export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "";
  return filename.slice(dot).toLowerCase();
}

export function resolveKbMimeType(filename: string, mimeType: string): string | null {
  const ext = getExtension(filename);
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";

  if (KB_ALLOWED_MIME_TYPES.has(normalized)) {
    return normalized;
  }

  const fromExt = EXTENSION_TO_MIME[ext];
  if (fromExt && KB_ALLOWED_MIME_TYPES.has(fromExt)) {
    return fromExt;
  }

  return null;
}

export function isKbFilenameAllowed(filename: string): boolean {
  const ext = getExtension(filename);
  return (KB_ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

export function sanitizeKbFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "document";
  return base.replace(/[^\w.\-() ]+/g, "_").slice(0, 200) || "document";
}

export function buildKbStoragePath(orgId: string, documentId: string, filename: string): string {
  return `${orgId}/${documentId}/${sanitizeKbFilename(filename)}`;
}
