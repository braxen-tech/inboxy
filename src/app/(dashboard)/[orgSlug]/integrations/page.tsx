import { getOrgBySlug } from "@/lib/get-org";
import { notFound } from "next/navigation";
import { IntegrationCard } from "./integration-card";
import { CalComCredentialsForm } from "./cal-com-credentials-form";
import { StripeCredentialsForm } from "./stripe-credentials-form";

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

  const isCalActive = org.cal_status === "active";
  const isStripeActive = org.stripe_status === "active";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte ferramentas do agente — calendário, pagamentos e outros serviços.
          Canais de mensagem ficam em <span className="font-medium text-foreground">Canais</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          description="Venda produtos com pagamento online"
          summary={isStripeActive ? "Conectado — produtos sendo exibidos pelo agente" : "Pendente de configuração"}
          icon={<StripeIcon />}
          status={isStripeActive ? "active" : "pending"}
        >
          <StripeCredentialsForm orgSlug={orgSlug} isConnected={isStripeActive} />
        </IntegrationCard>
      </div>
    </div>
  );
}
