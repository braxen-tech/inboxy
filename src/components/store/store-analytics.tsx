"use client";

import { useEffect } from "react";

interface StoreAnalyticsProps {
  orgId: string;
  orgSlug: string;
}

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, properties?: Record<string, unknown>) => void;
    };
  }
}

export function StoreAnalytics({ orgId, orgSlug }: StoreAnalyticsProps) {
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.posthog) {
        window.posthog.capture("store_page_view", {
          org_id: orgId,
          org_slug: orgSlug,
        });
      }
    } catch {
      // analytics should never break the page
    }
  }, [orgId, orgSlug]);

  return null;
}
