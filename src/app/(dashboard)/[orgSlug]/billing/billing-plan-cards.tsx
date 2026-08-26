"use client";

import { useTransition } from "react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { createCheckoutSessionAction } from "./actions";
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
  needsBillingSetup: boolean;
}

export function BillingPlanCards({ orgSlug, plans, needsBillingSetup }: Props) {
  const [pending, startTransition] = useTransition();

  function subscribe(planId: PlanId) {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.capture("billing_checkout_started", { org_slug: orgSlug, plan_id: planId });
    }
    startTransition(async () => {
      const r = await createCheckoutSessionAction(orgSlug, planId);
      if ("error" in r && r.error) {
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.captureException(new Error(r.error), { org_slug: orgSlug, plan_id: planId });
        }
        alert(r.error);
        return;
      }
      if ("url" in r && r.url) {
        window.location.href = r.url;
      }
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Pagamento via Asaas — PIX, boleto ou cartão. A cobrança é mensal, sem fidelidade.
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
              <Button type="button" disabled={pending} onClick={() => subscribe(plan.id)}>
                {pending ? "Redirecionando..." : "Assinar"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
