"use client";

import { useState } from "react";
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
} from "@stripe/react-connect-js";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { activateStripe, disconnectStripeAction, refreshStripeStatusAction } from "./actions";

interface StripeOnboardingProps {
  orgSlug: string;
  stripeAccountId: string | null;
  stripeAccountStatus: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

function statusBadge(status: string, chargesEnabled: boolean) {
  if (chargesEnabled) return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400">Ativo</Badge>;
  if (status === "onboarding") return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">Onboarding pendente</Badge>;
  if (status === "disabled") return <Badge variant="destructive">Desabilitado</Badge>;
  return <Badge variant="secondary">Não conectado</Badge>;
}

export function StripeOnboarding({
  orgSlug,
  stripeAccountId: initialAccountId,
  stripeAccountStatus: initialStatus,
  chargesEnabled: initialCharges,
  payoutsEnabled: initialPayouts,
}: StripeOnboardingProps) {
  const [accountId, setAccountId] = useState(initialAccountId);
  const [status, setStatus] = useState(initialStatus);
  const [chargesEnabled, setChargesEnabled] = useState(initialCharges);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const stripeConnectInstance = accountId && showOnboarding
    ? loadConnectAndInitialize({
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
        fetchClientSecret: async () => {
          const res = await fetch("/api/account-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orgSlug,
              components: { account_onboarding: { enabled: true } },
            }),
          });
          const data = await res.json();
          return data.clientSecret;
        },
        appearance: {
          variables: {
            fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif",
            fontSizeBase: "14px",
            borderRadius: "8px",
            colorPrimary: "hsl(221 83% 53%)",
          },
        },
      })
    : null;

  async function handleActivate() {
    setLoading(true);
    setError(null);
    const result = await activateStripe(orgSlug);
    if ("error" in result) {
      setError(result.error ?? null);
    } else {
      setAccountId(result.accountId ?? null);
      setStatus("onboarding" as string);
      setShowOnboarding(true);
    }
    setLoading(false);
  }

  async function handleRefresh() {
    setLoading(true);
    const result = await refreshStripeStatusAction(orgSlug);
    if ("error" in result) {
      setError(result.error ?? null);
    } else {
      setStatus((result.status as string) ?? "pending");
      if (result.status === "active") setChargesEnabled(true);
    }
    setLoading(false);
  }

  async function handleDisconnect() {
    if (!confirm("Tem certeza que deseja desconectar o Stripe? Os pagamentos da loja serão desativados.")) return;
    setLoading(true);
    const result = await disconnectStripeAction(orgSlug);
    if ("error" in result) {
      setError(result.error ?? null);
    } else {
      setAccountId(null);
      setStatus("pending");
      setChargesEnabled(false);
      setShowOnboarding(false);
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Stripe (Pagamentos)</CardTitle>
            <CardDescription>Receba pagamentos na sua loja via Stripe.</CardDescription>
          </div>
          {statusBadge(status, chargesEnabled)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {!accountId && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conecte sua conta Stripe para aceitar pagamentos de cartão de crédito em sua loja.
              O onboarding é feito diretamente aqui, sem precisar criar uma conta separada.
            </p>
            <Button onClick={handleActivate} disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Conectar com Stripe
            </Button>
          </div>
        )}

        {accountId && !chargesEnabled && !showOnboarding && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sua conta foi criada mas o onboarding ainda não foi concluído.
              Complete-o para ativar os pagamentos.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setShowOnboarding(true)} disabled={loading}>
                Continuar onboarding
              </Button>
              <Button variant="outline" onClick={handleRefresh} disabled={loading}>
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Verificar status
              </Button>
            </div>
          </div>
        )}

        {accountId && chargesEnabled && (
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <CheckCircle className="size-4" />
            Sua conta está ativa e pronta para receber pagamentos.
          </div>
        )}

        {showOnboarding && stripeConnectInstance && (
          <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
            <ConnectAccountOnboarding
              onExit={() => {
                setShowOnboarding(false);
                handleRefresh();
              }}
            />
          </ConnectComponentsProvider>
        )}

        {accountId && (
          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDisconnect}
              disabled={loading}
            >
              Desconectar Stripe
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
