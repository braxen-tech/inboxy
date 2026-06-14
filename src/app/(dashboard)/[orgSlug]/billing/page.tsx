import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { needsBillingSetup, getTrialPeriodDays } from "@/lib/billing-setup";
import { PLANS, QUOTA_WARNING_RATIO, type PlanId } from "@/lib/plans";
import { getMonthlyUsage } from "@/application/services/monthly-usage";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { syncOrgFromCheckoutSessionId, syncOrgBillingFromStripe } from "@/application/services/sync-billing-from-checkout";
import { BillingPlanCards } from "./billing-plan-cards";

interface Props {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ checkout?: string; setup?: string; session_id?: string }>;
}

const PLAN_LABELS: Record<PlanId, string> = {
  starter: "Starter",
  professional: "Professional",
  business: "Business",
};

const STATUS_LABELS: Record<string, string> = {
  trialing: "Período de teste",
  active: "Ativa",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
  unpaid: "Não paga",
};

export default async function BillingPage({ params, searchParams }: Props) {
  const { orgSlug } = await params;
  const { checkout, setup, session_id: sessionId } = await searchParams;
  let org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  if (
    checkout === "success" &&
    sessionId?.startsWith("cs_") &&
    needsBillingSetup(org)
  ) {
    try {
      await syncOrgFromCheckoutSessionId(getAdminClient(), sessionId, org.id);
      org = (await getOrgBySlug(orgSlug)) ?? org;
    } catch {
      // Webhook or Stripe search fallback may still apply.
    }
  }

  if (needsBillingSetup(org) && (checkout === "success" || org.stripe_customer_id)) {
    try {
      const synced = await syncOrgBillingFromStripe(getAdminClient(), org.id);
      if (synced) {
        org = (await getOrgBySlug(orgSlug)) ?? org;
      }
    } catch {
      // Keep showing setup UI; user can refresh after Stripe confirms.
    }
  }

  const billingSetupRequired = needsBillingSetup(org);
  const trialDays = getTrialPeriodDays();

  const db = getAdminClient();
  const usage = await getMonthlyUsage(db, org.id);
  const quota = org.message_quota ?? 500;
  const planId = (org.subscription_plan ?? "starter") as PlanId;
  const usageRatio = quota > 0 ? usage.messagesOut / quota : 0;
  const showQuotaWarning = usageRatio >= QUOTA_WARNING_RATIO && usageRatio < 1;
  const quotaExceeded = usage.messagesOut >= quota;

  const planCards = (Object.keys(PLANS) as PlanId[]).map((id) => ({
    id,
    name: PLANS[id].name,
    price: PLANS[id].price,
    messageQuota: PLANS[id].messageQuota,
    features: [...PLANS[id].features],
    isCurrent: id === planId,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          {billingSetupRequired ? "Ative sua conta" : "Assinatura"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {billingSetupRequired
            ? `Escolha um plano e cadastre o cartão para iniciar o trial de ${trialDays} dias. Você só será cobrado depois.`
            : "Gerencie seu plano e acompanhe o uso de mensagens do agente"}
        </p>
      </div>

      {(billingSetupRequired || setup === "required") && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-900 dark:text-blue-200">
          Para usar o Inboxy (agente, integrações e base de conhecimento), complete o cadastro no
          Stripe com um plano abaixo. O trial vale para Starter, Professional e Business.
        </div>
      )}

      {checkout === "success" && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-300">
          Cartão cadastrado. Seu trial de {trialDays} dias começa assim que o Stripe confirmar a
          assinatura (alguns segundos). Depois você pode acessar o restante do painel.
        </div>
      )}
      {checkout === "canceled" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          Checkout cancelado. Nenhuma cobrança foi feita.
        </div>
      )}

      {!billingSetupRequired && (
      <section className="rounded-xl border p-5 space-y-4">
        <h2 className="font-medium">Resumo</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Plano</dt>
            <dd className="font-medium">{PLAN_LABELS[planId] ?? planId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">
              {STATUS_LABELS[org.subscription_status ?? "trialing"] ??
                org.subscription_status}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Mensagens de saída (este mês)</dt>
            <dd className="font-medium">
              {usage.messagesOut.toLocaleString("pt-BR")} / {quota.toLocaleString("pt-BR")}
            </dd>
          </div>
          {org.subscription_current_period_end && (
            <div>
              <dt className="text-muted-foreground">Próxima renovação</dt>
              <dd className="font-medium">
                {new Date(org.subscription_current_period_end).toLocaleDateString("pt-BR")}
              </dd>
            </div>
          )}
        </dl>

        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all ${
              quotaExceeded
                ? "bg-destructive"
                : showQuotaWarning
                  ? "bg-amber-500"
                  : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(100, usageRatio * 100)}%` }}
          />
        </div>

        {showQuotaWarning && !quotaExceeded && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Você já usou {Math.round(usageRatio * 100)}% da cota deste mês. Considere fazer
            upgrade antes de atingir o limite — o agente passará para atendimento humano
            automaticamente.
          </p>
        )}
        {quotaExceeded && (
          <p className="text-sm text-destructive">
            Cota esgotada. Novas conversas serão transferidas para atendentes humanos até você
            fazer upgrade ou renovar o ciclo.
          </p>
        )}
      </section>
      )}

      <section>
        <h2 className="font-medium mb-4">
          {billingSetupRequired ? "Escolha seu plano" : "Planos"}
        </h2>
        <BillingPlanCards
          orgSlug={orgSlug}
          plans={planCards}
          hasStripeCustomer={!!org.stripe_customer_id}
          needsBillingSetup={billingSetupRequired}
          trialDays={trialDays}
        />
      </section>
    </div>
  );
}
