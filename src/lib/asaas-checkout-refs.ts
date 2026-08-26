/**
 * Org-level Asaas payments (webhook at /api/webhooks/asaas/[orgId]) cover two
 * kinds of purchases that share one webhook: physical/service orders
 * (externalReference = orders.id, unprefixed, for backward compatibility with
 * the AI agent's create_checkout tool) and digital product purchases
 * (externalReference = `${DIGITAL_PURCHASE_REF_PREFIX}${purchaseId}`).
 */
export const DIGITAL_PURCHASE_REF_PREFIX = "digital:";

export function digitalPurchaseReference(purchaseId: string): string {
  return `${DIGITAL_PURCHASE_REF_PREFIX}${purchaseId}`;
}

export function parseDigitalPurchaseReference(externalReference: string): string | null {
  if (!externalReference.startsWith(DIGITAL_PURCHASE_REF_PREFIX)) return null;
  return externalReference.slice(DIGITAL_PURCHASE_REF_PREFIX.length);
}
