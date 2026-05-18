import { getOrgBySlug } from "@/lib/get-org";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WhatsAppCredentialsForm } from "./whatsapp-credentials-form";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function IntegrationsPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const isActive = org.whatsapp_status === "active";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Integrações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte o WhatsApp Cloud API manualmente
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">WhatsApp</CardTitle>
            <Badge variant={isActive ? "default" : "secondary"} className={cn(isActive ? "bg-green-500 text-white" : "bg-yellow-500 text-white")}>
              {isActive ? "Conectado" : "Pendente"}
            </Badge>
          </div>
          <CardDescription>
            {isActive
              ? `Número: ${org.whatsapp_phone_number ?? "(sem exibição)"}`
              : "Cole da Meta o ID da conta (WABA), o ID do número e um access token com permissão no app WhatsApp."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-amber-600">
            Ao usar números na Cloud API, o app de celular deixa de ser o cliente principal —
            garanta webhook em <strong>Configuration</strong> no mesmo app na Meta que emitiu o token.
          </p>
          <WhatsAppCredentialsForm
            orgSlug={orgSlug}
            isConnected={isActive}
            savedWabaId={org.whatsapp_business_account_id ?? ""}
            savedPhoneNumberId={org.whatsapp_phone_number_id ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}
