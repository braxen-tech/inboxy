export type PlanId = "starter" | "professional" | "business";
export type PlanIntegration = "cal" | "stripe";

export const PLANS = {
  starter: {
    name: "Starter",
    price: 97,
    messageQuota: 500,
    allowedIntegrations: [] as PlanIntegration[],
    features: [
      "Agente IA com base de conhecimento",
      "Inbox via Chatwoot (canais no Chatwoot)",
      "500 mensagens de saída/mês",
    ],
  },
  professional: {
    name: "Professional",
    price: 297,
    messageQuota: 2000,
    allowedIntegrations: ["cal", "stripe"] as PlanIntegration[],
    features: [
      "Tudo do Starter",
      "Cal.com (agendamento)",
      "Stripe (vendas no chat)",
      "2.000 mensagens de saída/mês",
    ],
  },
  business: {
    name: "Business",
    price: 697,
    messageQuota: 10000,
    allowedIntegrations: ["cal", "stripe"] as PlanIntegration[],
    features: [
      "Tudo do Professional",
      "10.000 mensagens de saída/mês",
      "Suporte prioritário",
    ],
  },
} as const satisfies Record<
  PlanId,
  {
    name: string;
    price: number;
    messageQuota: number;
    allowedIntegrations: PlanIntegration[];
    features: string[];
  }
>;

/** Stripe Price IDs — override via env for other Stripe accounts */
function priceId(plan: PlanId): string {
  const envKey = {
    starter: process.env.STRIPE_PRICE_STARTER,
    professional: process.env.STRIPE_PRICE_PROFESSIONAL,
    business: process.env.STRIPE_PRICE_BUSINESS,
  }[plan];

  const defaults: Record<PlanId, string> = {
    starter: "price_1Tdxhp2Fvr0aymbcYy0WEoig",
    professional: "price_1Tdxhp2Fvr0aymbcv9dDpAgo",
    business: "price_1Tdxhp2Fvr0aymbciEYzoW7v",
  };

  return envKey?.trim() || defaults[plan];
}

export function getStripePriceId(plan: PlanId): string {
  return priceId(plan);
}

const PRICE_TO_PLAN: Record<string, PlanId> = Object.fromEntries(
  (Object.keys(PLANS) as PlanId[]).map((p) => [getStripePriceId(p), p]),
) as Record<string, PlanId>;

export function planFromStripePriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  return PRICE_TO_PLAN[priceId] ?? null;
}

/** Always available when Chatwoot is connected (not plan-gated). */
export const CHATWOOT_HANDOFF_TOOL = "transfer_to_human";
export const CHATWOOT_LABEL_TOOL = "manage_conversation_labels";

/** Enabled when org has at least one indexed KB document. */
export const LOOKUP_KNOWLEDGE_TOOL = "lookup_knowledge";

export const INTEGRATION_TOOLS: Record<PlanIntegration, string[]> = {
  cal: ["check_calendar_availability", "book_calendar_appointment"],
  stripe: [
    "search_products",
    "get_product_details",
    "show_product_images",
    "add_to_cart",
    "view_cart",
    "remove_from_cart",
    "create_checkout",
  ],
};

export function resolveAllowedTools(integrations: PlanIntegration[]): string[] {
  return integrations.flatMap((i) => INTEGRATION_TOOLS[i]);
}

/** Enabled when org has follow-up automático ativo. */
export const SCHEDULE_FOLLOWUP_TOOL = "schedule_followup";

export function resolveEnabledToolsForOrg(org: {
  subscription_plan?: string | null;
  cal_status?: string | null;
  cal_api_key?: string | null;
  cal_event_type_id?: string | null;
  stripe_status?: string | null;
  stripe_secret_key?: string | null;
  chatwoot_status?: string | null;
  chatwoot_api_token?: string | null;
  chatwoot_account_id?: string | null;
  tools_enabled?: string[] | null;
  hasKbDocuments?: boolean;
  followup_enabled?: boolean | null;
}): string[] {
  const planId = (org.subscription_plan ?? "starter") as PlanId;
  const plan = PLANS[planId] ?? PLANS.starter;
  const toolNamesFromPlan = resolveAllowedTools(plan.allowedIntegrations);

  const fromPlan = toolNamesFromPlan.filter((name) => {
    if (INTEGRATION_TOOLS.cal.includes(name)) {
      return org.cal_status === "active" && !!org.cal_api_key && !!org.cal_event_type_id;
    }
    if (INTEGRATION_TOOLS.stripe.includes(name)) {
      return org.stripe_status === "active" && !!org.stripe_secret_key;
    }
    return false;
  });

  const base = [...(org.tools_enabled ?? [])];
  for (const name of fromPlan) {
    if (!base.includes(name)) base.push(name);
  }

  if (
    org.chatwoot_status === "active" &&
    org.chatwoot_api_token &&
    org.chatwoot_account_id &&
    !base.includes(CHATWOOT_HANDOFF_TOOL)
  ) {
    base.push(CHATWOOT_HANDOFF_TOOL);
  }

  if (
    org.chatwoot_status === "active" &&
    org.chatwoot_api_token &&
    org.chatwoot_account_id &&
    !base.includes(CHATWOOT_LABEL_TOOL)
  ) {
    base.push(CHATWOOT_LABEL_TOOL);
  }

  if (org.hasKbDocuments && !base.includes(LOOKUP_KNOWLEDGE_TOOL)) {
    base.push(LOOKUP_KNOWLEDGE_TOOL);
  }

  if (
    org.followup_enabled &&
    org.chatwoot_status === "active" &&
    org.chatwoot_api_token &&
    org.chatwoot_account_id &&
    !base.includes(SCHEDULE_FOLLOWUP_TOOL)
  ) {
    base.push(SCHEDULE_FOLLOWUP_TOOL);
  }

  return base;
}

export const QUOTA_WARNING_RATIO = 0.8;

export const QUOTA_HANDOFF_MESSAGE =
  "Um momento, vou transferir você para um de nossos atendentes.";
