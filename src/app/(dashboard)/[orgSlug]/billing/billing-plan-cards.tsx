"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createCheckoutSessionAction, createPortalSessionAction } from "./actions";
import type { PlanId } from "@/lib/plans";

interface PlanCard {
  id: PlanId;
  name: string;
  price: number;
  messageQuota: number;
  features: string[];
  isCurrent: boolean;
}

interface Props {
  orgSlug: string;
  plans: PlanCard[];
  hasStripeCustomer: boolean;
  needsBillingSetup: boolean;
  trialDays: number;
}

export function BillingPlanCards({
  orgSlug,
  plans,
  hasStripeCustomer,
  needsBillingSetup,
  trialDays,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [portalPending, setPortalPending] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function subscribe(planId: PlanId) {
    setMessage(null);
    startTransition(async () => {
      const r = await createCheckoutSessionAction(orgSlug, planId);
      if ("error" in r && r.error) {
        setMessage({ type: "err", text: r.error });
        return;
      }
      if ("url" in r && r.url) {
        window.location.href = r.url;
      }
    });
  }

  async function openPortal() {
    setMessage(null);
    setPortalPending(true);
    const r = await createPortalSessionAction(orgSlug);
    setPortalPending(false);
    if ("error" in r && r.error) {
      setMessage({ type: "err", text: r.error });
      return;
    }
    if ("url" in r && r.url) {
      window.location.href = r.url;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {message && (
        <p
          className={
            message.type === "err"
              ? "text-sm text-destructive"
              : "text-sm text-green-600 dark:text-green-400"
          }
        >
          {message.text}
        </p>
      )}

      {hasStripeCustomer && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={portalPending}
            onClick={() => void openPortal()}
          >
            {portalPending ? "Abrindo..." : "Gerenciar assinatura"}
          </Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Todos os planos incluem {trialDays} dias de trial. O cartão é cadastrado agora; a cobrança
        só começa após o período de teste.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-xl border p-5 flex flex-col ${
              plan.isCurrent ? "border-blue-500/50 bg-blue-500/5" : "border-border"
            }`}
          >
            <div className="mb-4">
              <h3 className="font-semibold text-lg">{plan.name}</h3>
              <p className="text-2xl font-bold mt-1">
                R$ {plan.price}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {plan.messageQuota.toLocaleString("pt-BR")} mensagens de saída/mês
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {trialDays} dias grátis para testar
              </p>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1.5 flex-1 mb-4">
              {plan.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            {plan.isCurrent && !needsBillingSetup ? (
              <Button type="button" variant="secondary" disabled>
                Plano atual
              </Button>
            ) : (
              <Button
                type="button"
                disabled={pending}
                onClick={() => subscribe(plan.id)}
              >
                {pending
                  ? "Redirecionando..."
                  : needsBillingSetup
                    ? `Iniciar trial (${trialDays} dias)`
                    : plan.isCurrent
                      ? "Gerenciar no Stripe"
                      : "Assinar"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
