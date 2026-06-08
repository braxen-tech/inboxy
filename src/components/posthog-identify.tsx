"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

interface PostHogIdentifyProps {
  userId: string;
  email?: string | null;
  orgId: string;
  orgSlug: string;
  orgName: string;
  plan?: string | null;
}

export function PostHogIdentify({
  userId,
  email,
  orgId,
  orgSlug,
  orgName,
  plan,
}: PostHogIdentifyProps) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.identify(userId, email ? { email } : undefined);
    posthog.group("organization", orgId, {
      slug: orgSlug,
      name: orgName,
      ...(plan ? { plan } : {}),
    });
  }, [userId, email, orgId, orgSlug, orgName, plan]);

  return null;
}
