"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { syncBillingFromStripeAction } from "./actions";

interface Props {
  orgSlug: string;
  needsBillingSetup: boolean;
  sessionId?: string;
}

/** Retries Stripe → Supabase sync when webhooks miss (common on staging). */
export function BillingAutoSync({ orgSlug, needsBillingSetup, sessionId }: Props) {
  const router = useRouter();
  const attempted = useRef(false);

  useEffect(() => {
    if (!needsBillingSetup || attempted.current) return;
    attempted.current = true;

    void (async () => {
      const result = await syncBillingFromStripeAction(orgSlug);
      if ("ok" in result && result.ok) {
        router.refresh();
      }
    })();
  }, [needsBillingSetup, orgSlug, router, sessionId]);

  return null;
}
