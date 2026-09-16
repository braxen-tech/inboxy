"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  ConnectComponentsProvider,
  ConnectPayments,
  ConnectPayouts,
  ConnectBalances,
  ConnectNotificationBanner,
} from "@stripe/react-connect-js";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FinancesPageClientProps {
  orgSlug: string;
  stripeAccountId: string | null;
  stripeAccountStatus: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

function useStripeConnect(orgSlug: string, stripeAccountId: string | null) {
  const stripeConnectInstance = stripeAccountId
    ? loadConnectAndInitialize({
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
        fetchClientSecret: async () => {
          const res = await fetch("/api/account-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orgSlug,
              components: {
                payments: { enabled: true },
                payouts: { enabled: true },
                balances: { enabled: true },
                notification_banner: { enabled: true },
              },
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

  return stripeConnectInstance;
}

export function FinancesPageClient({
  orgSlug,
  stripeAccountId,
  stripeAccountStatus,
}: FinancesPageClientProps) {
  const t = useTranslations("finances");
  const stripeConnectInstance = useStripeConnect(orgSlug, stripeAccountId);

  if (!stripeAccountId || stripeAccountStatus === "pending") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {t("setupStripe")}
        </div>
      </div>
    );
  }

  if (!stripeConnectInstance) return null;

  return (
    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>

        <ConnectNotificationBanner />

        <Card>
          <CardHeader>
            <CardTitle>{t("balance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ConnectBalances />
          </CardContent>
        </Card>

        <Tabs defaultValue="payments">
          <TabsList>
            <TabsTrigger value="payments">{t("transactions")}</TabsTrigger>
            <TabsTrigger value="payouts">{t("revenue")}</TabsTrigger>
          </TabsList>
          <TabsContent value="payments" className="mt-4">
            <ConnectPayments />
          </TabsContent>
          <TabsContent value="payouts" className="mt-4">
            <ConnectPayouts />
          </TabsContent>
        </Tabs>
      </div>
    </ConnectComponentsProvider>
  );
}
