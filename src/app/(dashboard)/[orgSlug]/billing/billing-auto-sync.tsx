"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { syncBillingStatusAction } from "./actions";

interface Props {
  orgSlug: string;
  needsBillingSetup: boolean;
  sessionId?: string;
}

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 10;

/** Polls the DB for the Asaas billing webhook to land after checkout (webhooks can take a few seconds). */
export function BillingAutoSync({ orgSlug, needsBillingSetup }: Props) {
  const router = useRouter();
  const attempts = useRef(0);

  useEffect(() => {
    if (!needsBillingSetup) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (cancelled || attempts.current >= MAX_ATTEMPTS) return;
      attempts.current += 1;

      const result = await syncBillingStatusAction(orgSlug);
      if ("ok" in result && result.ok) {
        router.refresh();
        return;
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    timer = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [needsBillingSetup, orgSlug, router]);

  return null;
}
