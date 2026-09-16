import { getOrgBySlug } from "@/lib/get-org";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { IntegrationCard } from "./integration-card";
import { CalComCredentialsForm } from "./cal-com-credentials-form";
import { StripeOnboarding } from "./stripe-onboarding";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

function CalComIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
      <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}

function StripeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="#635BFF" strokeWidth="2" />
      <path d="M6 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z" fill="#635BFF" />
      <path d="M14 10h4M14 14h4" stroke="#635BFF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default async function IntegrationsPage({ params }: Props) {
  const { orgSlug } = await params;
  const [org, t] = await Promise.all([
    getOrgBySlug(orgSlug),
    getTranslations("integrations"),
  ]);
  if (!org) notFound();

  const isCalActive = !!org.cal_managed_user_id && !!org.cal_access_token_enc;
  const isStripeActive = org.stripe_account_status === "active";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("description")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <IntegrationCard
          name="Cal.com"
          description={t("calDescription")}
          summary={
            isCalActive
              ? `Event Type: ${org.cal_event_type_id} · ${org.cal_timezone ?? "America/Sao_Paulo"}`
              : t("pending")
          }
          icon={<CalComIcon />}
          status={isCalActive ? "active" : "pending"}
        >
          <CalComCredentialsForm
            orgSlug={orgSlug}
            isConnected={isCalActive}
            savedEventTypeId={org.cal_event_type_id ?? ""}
            savedTimezone={org.cal_timezone ?? "America/Sao_Paulo"}
          />
        </IntegrationCard>

        <IntegrationCard
          name="Stripe"
          description={t("stripeDescription")}
          summary={
            isStripeActive
              ? t("stripeActive")
              : org.stripe_account_status === "onboarding"
                ? t("onboardingPending")
                : t("pending")
          }
          icon={<StripeIcon />}
          status={isStripeActive ? "active" : "pending"}
        >
          <StripeOnboarding
            orgSlug={orgSlug}
            stripeAccountId={org.stripe_account_id ?? null}
            stripeAccountStatus={org.stripe_account_status ?? "pending"}
            chargesEnabled={org.stripe_charges_enabled ?? false}
            payoutsEnabled={org.stripe_payouts_enabled ?? false}
          />
        </IntegrationCard>
      </div>
    </div>
  );
}
