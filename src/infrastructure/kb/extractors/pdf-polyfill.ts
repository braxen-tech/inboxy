/** pdf-parse v2 (pdf.js) expects browser APIs such as DOMMatrix — missing on Vercel Node. */
let polyfillsReady: Promise<void> | null = null;

export function ensurePdfServerPolyfills(): Promise<void> {
  if (polyfillsReady) return polyfillsReady;

  polyfillsReady = (async () => {
    if (globalThis.DOMMatrix) return;

    try {
      const canvas = await import("@napi-rs/canvas");
      if (canvas.DOMMatrix) {
        globalThis.DOMMatrix = canvas.DOMMatrix as typeof globalThis.DOMMatrix;
        return;
      }
    } catch {
      // Native canvas may be unavailable in serverless bundles.
    }

    const { default: DOMMatrix } = await import("@thednp/dommatrix");
    globalThis.DOMMatrix = DOMMatrix as typeof globalThis.DOMMatrix;
  })();

  return polyfillsReady;
}
