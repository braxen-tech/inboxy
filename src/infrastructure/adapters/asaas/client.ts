const ASAAS_BASE_URL = process.env.ASAAS_API_BASE_URL ?? "https://api.asaas.com/v3";

export class AsaasApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`Asaas API error ${status}: ${JSON.stringify(body)}`);
    this.name = "AsaasApiError";
  }
}

async function request<T>(
  apiKey: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    method,
    headers: {
      "access_token": apiKey,
      "Content-Type": "application/json",
      "User-Agent": "inboxy/1.0",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new AsaasApiError(res.status, json);
  }

  return json as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AsaasPaymentLink {
  id: string;
  name: string;
  url: string;
  billingType: string;
  chargeType: string;
  value: number;
  externalReference?: string;
}

export interface AsaasPayment {
  id: string;
  status:
    | "PENDING"
    | "RECEIVED"
    | "CONFIRMED"
    | "OVERDUE"
    | "REFUNDED"
    | "RECEIVED_IN_CASH"
    | "REFUND_REQUESTED"
    | "CHARGEBACK_REQUESTED"
    | "CHARGEBACK_DISPUTE"
    | "AWAITING_CHARGEBACK_REVERSAL"
    | "DUNNING_REQUESTED"
    | "DUNNING_RECEIVED"
    | "AWAITING_RISK_ANALYSIS"
    | "CANCELED";
  value: number;
  netValue?: number;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  externalReference?: string;
}

// ─── API wrappers ─────────────────────────────────────────────────────────────

export interface CreatePaymentLinkInput {
  name: string;
  description?: string;
  billingType: "UNDEFINED" | "PIX" | "BOLETO" | "CREDIT_CARD";
  chargeType: "DETACHED" | "RECURRENT";
  value: number;
  subscriptionCycle?: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY";
  externalReference?: string;
  /** Business days until the charge is due. Asaas requires this for every payment link. */
  dueDateLimitDays?: number;
}

const DEFAULT_DUE_DATE_LIMIT_DAYS = 3;

export async function createPaymentLink(
  apiKey: string,
  input: CreatePaymentLinkInput,
): Promise<AsaasPaymentLink> {
  return request<AsaasPaymentLink>(apiKey, "POST", "/paymentLinks", {
    dueDateLimitDays: DEFAULT_DUE_DATE_LIMIT_DAYS,
    ...input,
  });
}

export async function getPayment(
  apiKey: string,
  paymentId: string,
): Promise<AsaasPayment> {
  return request<AsaasPayment>(apiKey, "GET", `/payments/${paymentId}`);
}

export async function cancelSubscription(apiKey: string, subscriptionId: string): Promise<void> {
  await request<{ deleted: boolean }>(apiKey, "DELETE", `/subscriptions/${subscriptionId}`);
}

export interface CreateSubaccountInput {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  incomeValue: number;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
  companyType?: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
}

export interface AsaasSubaccount {
  id: string;
  apiKey: string;
  walletId: string;
}

/**
 * Creates an Asaas subaccount (white-label) for an org, using the platform's
 * own master API key. The returned apiKey is shown only once — store it
 * (encrypted) immediately.
 */
export async function createSubaccount(
  platformApiKey: string,
  input: CreateSubaccountInput,
): Promise<AsaasSubaccount> {
  const result = await request<{ id: string; apiKey: string; walletId: string }>(
    platformApiKey,
    "POST",
    "/accounts",
    input,
  );
  return { id: result.id, apiKey: result.apiKey, walletId: result.walletId };
}

const WEBHOOK_EVENTS = [
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
];

/**
 * Registers a webhook on an Asaas account (subconta or master) so payment
 * events are pushed to our endpoint. Each Asaas account manages its own
 * webhooks — this must be called with THAT account's own apiKey.
 */
export async function createWebhook(
  apiKey: string,
  input: { name: string; url: string; email: string; authToken: string },
): Promise<{ id: string }> {
  return request<{ id: string }>(apiKey, "POST", "/webhooks", {
    name: input.name,
    url: input.url,
    email: input.email,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken: input.authToken,
    sendType: "SEQUENTIALLY",
    events: WEBHOOK_EVENTS,
  });
}
