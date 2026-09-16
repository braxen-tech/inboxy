import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getOrgBySlug } from "@/lib/get-org";
import { needsBillingSetup, isPilotMode } from "@/lib/billing-setup";
import { PLANS, QUOTA_WARNING_RATIO, type PlanId } from "@/lib/plans";
import { getMonthlyUsage } from "@/application/services/monthly-usage";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { BillingPlanCards } from "./billing-plan-cards";
import { BillingAutoSync } from "./billing-auto-sync";

interface Props {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ checkout?: string; setup?: string }>;
}

export default async function BillingPage({ params, searchParams }: Props) {
  const { orgSlug } = await params;
  const { checkout, setup } = await searchParams;

  if (isPilotMode()) {
    redirect(`/${orgSlug}/kb`);
  }

  const [org, t] = await Promise.all([
    getOrgBySlug(orgSlug),
    getTranslations("billing"),
  ]);
  if (!org) notFound();

  const billingSetupRequired = needsBillingSetup(org);

  const STATUS_LABELS: Record<string, string> = {
    trialing: t("trialing"),
    active: t("activeStatus"),
    past_due: t("pastDue"),
    canceled: t("canceledStatus"),
    unpaid: t("unpaid"),
  };

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
      <BillingAutoSync orgSlug={orgSlug} needsBillingSetup={billingSetupRequired} />
      <div>
        <h1 className="text-2xl font-semibold">
          {billingSetupRequired ? t("activateAccount") : t("title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {billingSetupRequired ? t("choosePlan") : t("managePlanUsage")}
        </p>
      </div>

      {(billingSetupRequired || setup === "required") && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-900 dark:text-blue-200">
          {t("choosePlanToContinue")}
        </div>
      )}

      {checkout === "success" && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-300">
          {t("paymentConfirmPending")}
        </div>
      )}

      {!billingSetupRequired && (
      <section className="rounded-xl border p-5 space-y-4">
        <h2 className="font-medium">{t("summary")}</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("plan")}</dt>
            <dd className="font-medium">{planId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("statusLabel")}</dt>
            <dd className="font-medium">
              {STATUS_LABELS[org.subscription_status ?? "trialing"] ??
                org.subscription_status}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("outMessages")}</dt>
            <dd className="font-medium">
              {usage.messagesOut.toLocaleString()} / {quota.toLocaleString()}
            </dd>
          </div>
          {org.subscription_current_period_end && (
            <div>
              <dt className="text-muted-foreground">{t("nextRenewal")}</dt>
              <dd className="font-medium">
                {new Date(org.subscription_current_period_end).toLocaleDateString()}
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
            {t("quotaWarning", { percent: Math.round(usageRatio * 100) })}
          </p>
        )}
        {quotaExceeded && (
          <p className="text-sm text-destructive">
            {t("quotaExceeded")}
          </p>
        )}
      </section>
      )}

      <section>
        <h2 className="font-medium mb-4">
          {billingSetupRequired ? t("choosePlanLabel") : t("plans")}
        </h2>
        <BillingPlanCards
          orgSlug={orgSlug}
          plans={planCards}
          needsBillingSetup={billingSetupRequired}
        />
      </section>
    </div>
  );
}
