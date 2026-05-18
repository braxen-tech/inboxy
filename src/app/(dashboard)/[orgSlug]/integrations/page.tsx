import { getOrgBySlug } from "@/lib/get-org";
import { notFound } from "next/navigation";
import { IntegrationCard } from "./integration-card";
import { WhatsAppCredentialsForm } from "./whatsapp-credentials-form";
import { CalComCredentialsForm } from "./cal-com-credentials-form";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none">
      <path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
        fill="#25D366"
      />
      <path
        d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.96 7.96 0 01-4.11-1.14l-.29-.174-3.01.79.8-2.93-.19-.3A7.96 7.96 0 014 12c0-4.42 3.58-8 8-8s8 3.58 8 8-3.58 8-8 8z"
        fill="#25D366"
      />
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

export default async function IntegrationsPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const isWhatsAppActive = org.whatsapp_status === "active";
  const isCalActive = org.cal_status === "active";

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
          name="WhatsApp"
          description="Receba e envie mensagens pelo WhatsApp Cloud API"
          summary={
            isWhatsAppActive
              ? `Número: ${org.whatsapp_phone_number ?? "(sem exibição)"}`
              : "Pendente de configuração"
          }
          icon={<WhatsAppIcon />}
          status={isWhatsAppActive ? "active" : "pending"}
        >
          <div className="space-y-6">
            <p className="text-sm text-amber-600">
              Ao usar números na Cloud API, o app de celular deixa de ser o
              cliente principal — garanta webhook em{" "}
              <strong>Configuration</strong> no mesmo app na Meta que emitiu o
              token.
            </p>
            <WhatsAppCredentialsForm
              orgSlug={orgSlug}
              isConnected={isWhatsAppActive}
              savedWabaId={org.whatsapp_business_account_id ?? ""}
              savedPhoneNumberId={org.whatsapp_phone_number_id ?? ""}
            />
          </div>
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
      </div>
    </div>
  );
}
