/** pdf-parse v2 (pdf.js) expects browser APIs and a worker file — missing on Vercel Node. */
let polyfillsReady: Promise<void> | null = null;

export function ensurePdfServerPolyfills(): Promise<void> {
  if (polyfillsReady) return polyfillsReady;

  polyfillsReady = (async () => {
    if (!globalThis.DOMMatrix) {
      try {
        const canvas = await import("@napi-rs/canvas");
        if (canvas.DOMMatrix) {
          globalThis.DOMMatrix = canvas.DOMMatrix as typeof globalThis.DOMMatrix;
        }
      } catch {
        // Native canvas may be unavailable in serverless bundles.
      }

      if (!globalThis.DOMMatrix) {
        const { default: DOMMatrix } = await import("@thednp/dommatrix");
        globalThis.DOMMatrix = DOMMatrix as typeof globalThis.DOMMatrix;
      }
    }

    // pdfjs defaults to pdfjs-dist/legacy/build/pdf.worker.mjs, which is not
    // present in Vercel's /var/task bundle. Point at pdf-parse's bundled worker.
    const [{ getPath }, { PDFParse }] = await Promise.all([
      import("pdf-parse/worker"),
      import("pdf-parse"),
    ]);
    PDFParse.setWorker(getPath());
  })();

  return polyfillsReady;
}
