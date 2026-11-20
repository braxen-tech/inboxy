import { getOrgBySlug } from "@/lib/get-org";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { IntegrationCard } from "./integration-card";
import { ChatwootCredentialsForm } from "./chatwoot-credentials-form";
import { CalComCredentialsForm } from "./cal-com-credentials-form";
import { StripeOnboarding } from "./stripe-onboarding";
import { buildAgentBotWebhookUrl } from "@/lib/chatwoot-agent-bot";
import { TelegramConnectForm, WhatsAppConnectForm } from "./channel-connect-forms";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { buildChannelWebhookUrl } from "@/application/use-cases/connect-channel";

interface ConnectionRow {
  id: string;
  channel: "whatsapp_cloud" | "telegram";
  status: string;
  config: Record<string, string | null | undefined>;
  webhook_secret: string;
  last_error: string | null;
}

async function getChannelConnections(orgId: string): Promise<ConnectionRow[]> {
  // Returns [] until migration 00047 is applied.
  const { data } = await getAdminClient()
    .from("channel_connections")
    .select("id, channel, status, config, webhook_secret, last_error")
    .eq("organization_id", orgId);
  return (data as ConnectionRow[] | null) ?? [];
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none">
      <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4l-4.5 1.1z" stroke="#25D366" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 8.5c.3 2.6 2.4 4.9 5 5.5l1-1.2 2 1-.4 1.6c-3.8.3-8-3.5-8-7.6L10 7.4l1 2-1 1.1" fill="#25D366" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none">
      <path d="M21 4L3 11l6 2 2 6 3-4 5 4 2-15z" stroke="#229ED9" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 13l9-7" stroke="#229ED9" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  params: Promise<{ orgSlug: string }>;
}

function ChatwootIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none">
      <path d="M12 2C6.48 2 2 6.03 2 11c0 2.76 1.36 5.22 3.5 6.87V22l3.93-2.16c.82.22 1.68.16 2.57.16 5.52 0 10-4.03 10-9S17.52 2 12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
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

  const connections = await getChannelConnections(org.id);
  const wa = connections.find((c) => c.channel === "whatsapp_cloud");
  const tg = connections.find((c) => c.channel === "telegram");
  const isWaActive = wa?.status === "active";
  const isTgActive = tg?.status === "active";

  const isChatwootActive = org.chatwoot_status === "active";
  const chatwootWebhookUrl = org.chatwoot_agent_bot_webhook_secret
    ? buildAgentBotWebhookUrl(org.chatwoot_agent_bot_webhook_secret)
    : null;
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
          name="WhatsApp"
          description="API oficial da Meta (WhatsApp Cloud API) com o agente de IA"
          summary={isWaActive ? (wa?.config.display_phone_number ?? "Conectado") : t("pending")}
          icon={<WhatsAppIcon />}
          status={isWaActive ? "active" : "pending"}
        >
          <WhatsAppConnectForm
            orgSlug={orgSlug}
            isConnected={isWaActive}
            displayPhoneNumber={wa?.config.display_phone_number ?? null}
            savedPhoneNumberId={wa?.config.phone_number_id ?? ""}
            savedWabaId={wa?.config.waba_id ?? ""}
            webhookUrl={wa ? buildChannelWebhookUrl(wa.id) : null}
            verifyToken={wa?.webhook_secret ?? null}
          />
        </IntegrationCard>

        <IntegrationCard
          name="Telegram"
          description="Atenda pelo seu bot do Telegram com o agente de IA"
          summary={isTgActive && tg?.config.bot_username ? `@${tg.config.bot_username}` : t("pending")}
          icon={<TelegramIcon />}
          status={isTgActive ? "active" : "pending"}
        >
          <TelegramConnectForm
            orgSlug={orgSlug}
            isConnected={isTgActive}
            botUsername={tg?.config.bot_username ?? null}
            lastError={tg?.last_error ?? null}
          />
        </IntegrationCard>

        <IntegrationCard
          name="Chatwoot"
          description="Conecte WhatsApp, Instagram e chat com agente de IA"
          summary={
            isChatwootActive
              ? `Account ${org.chatwoot_account_id}`
              : t("pending")
          }
          icon={<ChatwootIcon />}
          status={isChatwootActive ? "active" : "pending"}
        >
          <ChatwootCredentialsForm
            orgSlug={orgSlug}
            isConnected={isChatwootActive}
            savedApiUrl={org.chatwoot_api_url ?? ""}
            savedAccountId={org.chatwoot_account_id ?? ""}
            savedAgentBotId={org.chatwoot_agent_bot_id ?? ""}
            agentBotWebhookUrl={chatwootWebhookUrl}
            hasBotAccessToken={!!org.chatwoot_agent_bot_access_token}
          />
        </IntegrationCard>

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
