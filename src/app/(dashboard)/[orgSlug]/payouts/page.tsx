import { notFound } from "next/navigation";
import { ExternalLink, Wallet, ArrowRight } from "lucide-react";
import { getOrgBySlug } from "@/lib/get-org";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

const ASAAS_DASHBOARD_URL = process.env.ASAAS_API_BASE_URL?.includes("sandbox")
  ? "https://sandbox.asaas.com"
  : "https://www.asaas.com";

export default async function PayoutsPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const isAsaasActive = org.asaas_status === "active";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie seus recebimentos, saques e dados financeiros
        </p>
      </div>

      {isAsaasActive ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15">
                <Wallet className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle>Conta financeira ativa</CardTitle>
                <CardDescription>
                  Sua conta Asaas está conectada e pronta para receber pagamentos
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No painel financeiro você pode:
            </p>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <ArrowRight className="size-4 mt-0.5 shrink-0 text-emerald-500" />
                Ver seu saldo disponível e pendente
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="size-4 mt-0.5 shrink-0 text-emerald-500" />
                Solicitar saques via PIX ou transferência bancária
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="size-4 mt-0.5 shrink-0 text-emerald-500" />
                Acompanhar extrato de vendas e recebimentos
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="size-4 mt-0.5 shrink-0 text-emerald-500" />
                Gerenciar dados bancários e chaves PIX
              </li>
            </ul>

            <a
              href={ASAAS_DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="mt-2 gap-2">
                Acessar painel financeiro
                <ExternalLink className="size-4" />
              </Button>
            </a>

            <p className="text-xs text-muted-foreground">
              Você será redirecionado para o painel da Asaas. Use o mesmo e-mail cadastrado para fazer login.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Conta financeira pendente</CardTitle>
            <CardDescription>
              Conecte sua conta Asaas na página de integrações para começar a receber pagamentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href={`/${orgSlug}/integrations`}>
              <Button variant="outline" className="gap-2">
                Ir para integrações
                <ArrowRight className="size-4" />
              </Button>
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
