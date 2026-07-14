import { getOrgBySlug } from "@/lib/get-org";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { notFound } from "next/navigation";
import { IntegrationCard } from "./integration-card";
import { ChannelsCard } from "./channels-card";
import { CalComCredentialsForm } from "./cal-com-credentials-form";
import { StripeCredentialsForm } from "./stripe-credentials-form";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

function WhatsappIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="#25D366">
      <path d="M17.5 14.4c-.3-.15-1.77-.87-2.05-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.96 1.17-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.79-1.68-2.09-.18-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.68-1.63-.93-2.24-.25-.6-.5-.51-.68-.52a13 13 0 0 0-.58-.01c-.2 0-.52.07-.8.37-.28.3-1.07 1.05-1.07 2.55 0 1.5 1.1 2.95 1.25 3.15.15.2 2.17 3.31 5.26 4.63.73.32 1.3.51 1.75.65.74.23 1.4.2 1.93.12.59-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35zM12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l4.93-1.38A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" />
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

  const supabase = await getServerClientFromCookies();
  const { data: channels } = await supabase
    .from("channels")
    .select("id, type, status, phone_number, display_name, ig_username, connected_at")
    .eq("organization_id", org.id)
    .order("connected_at", { ascending: false });

  const activeChannels = (channels ?? []).filter((c) => c.status === "active");
  const hasActiveChannel = activeChannels.length > 0;

  const isCalActive = org.cal_status === "active";
  const isStripeActive = org.stripe_status === "active";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte seus canais e serviços para habilitar funcionalidades do agente
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <IntegrationCard
          name="Canais de mensagem"
          description="Conecte WhatsApp e Instagram DM via Embedded Signup"
          summary={
            hasActiveChannel
              ? `${activeChannels.length} canal(is) conectado(s)`
              : "Nenhum canal conectado"
          }
          icon={<WhatsappIcon />}
          status={hasActiveChannel ? "active" : "pending"}
        >
          <ChannelsCard orgSlug={orgSlug} channels={channels ?? []} />
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
