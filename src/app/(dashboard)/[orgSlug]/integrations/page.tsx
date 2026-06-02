import { getOrgBySlug } from "@/lib/get-org";
import { buildAgentBotWebhookUrl } from "@/lib/chatwoot-agent-bot";
import { notFound } from "next/navigation";
import { IntegrationCard } from "./integration-card";
import { ChatwootCredentialsForm } from "./chatwoot-credentials-form";
import { CalComCredentialsForm } from "./cal-com-credentials-form";
import { StripeCredentialsForm } from "./stripe-credentials-form";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

function ChatwootIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none">
      <path
        d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l4.93-1.38A9.94 9.94 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.74 0-3.36-.56-4.68-1.5l-.32-.22-3.36.88.9-3.28-.24-.34A7.92 7.92 0 014 12c0-4.42 3.58-8 8-8s8 3.58 8 8-3.58 8-8 8z"
        fill="#1F93FF"
      />
      <circle cx="8" cy="12" r="1.5" fill="#1F93FF" />
      <circle cx="12" cy="12" r="1.5" fill="#1F93FF" />
      <circle cx="16" cy="12" r="1.5" fill="#1F93FF" />
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
      <path
        d="M12 9.5c-1.5 0-2.5.5-2.5 1.25 0 1.75 5 1 5 3.5 0 1-1.25 1.75-3 1.75s-2.75-.5-2.75-.5M12.5 8v8"
        stroke="#635BFF"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default async function IntegrationsPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const isChatwootActive = org.chatwoot_status === "active";
  const agentBotWebhookUrl =
    org.chatwoot_agent_bot_webhook_secret != null
      ? buildAgentBotWebhookUrl(org.chatwoot_agent_bot_webhook_secret)
      : null;
  const isCalActive = org.cal_status === "active";
  const isStripeActive = org.stripe_status === "active";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte seus serviços para habilitar funcionalidades do agente
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <IntegrationCard
          name="Chatwoot"
          description="Receba e responda mensagens de qualquer canal via Chatwoot"
          summary={
            isChatwootActive
              ? org.chatwoot_agent_bot_id
                ? `Bot ${org.chatwoot_agent_bot_id} · Account ${org.chatwoot_account_id}`
                : `Account ${org.chatwoot_account_id}`
              : "Pendente de configuração"
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
            agentBotWebhookUrl={agentBotWebhookUrl}
            hasBotAccessToken={!!org.chatwoot_agent_bot_access_token}
          />
        </IntegrationCard>

        <IntegrationCard
          name="Cal.com"
          description="Consulte disponibilidade e agende automaticamente"
          summary={
            isCalActive
              ? `Event Type: ${org.cal_event_type_id} · ${org.cal_timezone}`
              : "Pendente de configuração"
          }
          icon={<CalComIcon />}
          status={isCalActive ? "active" : "pending"}
        >
          <CalComCredentialsForm
            orgSlug={orgSlug}
            isConnected={isCalActive}
            savedEventTypeId={org.cal_event_type_id ?? ""}
            savedTimezone={org.cal_timezone ?? "America/Sao_Paulo"}
            savedBookingUrl={org.cal_booking_url ?? ""}
          />
        </IntegrationCard>

        <IntegrationCard
          name="Stripe"
          description="Venda produtos via WhatsApp com pagamento online"
          summary={
            isStripeActive
              ? "Conectado — produtos sendo exibidos pelo agente"
              : "Pendente de configuração"
          }
          icon={<StripeIcon />}
          status={isStripeActive ? "active" : "pending"}
        >
          <StripeCredentialsForm
            orgSlug={orgSlug}
            isConnected={isStripeActive}
          />
        </IntegrationCard>
      </div>
    </div>
  );
}
