"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveStripeCredentials, disconnectStripeAction } from "./actions";

interface Props {
  orgSlug: string;
  isConnected: boolean;
}

export function StripeCredentialsForm({ orgSlug, isConnected }: Props) {
  const router = useRouter();
  const [secretKey, setSecretKey] = useState("");
  const [pending, startTransition] = useTransition();
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const r = await saveStripeCredentials({ orgSlug, secretKey });
      if ("error" in r && r.error) {
        setMessage({ type: "err", text: r.error });
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.captureException(new Error(r.error), { org_slug: orgSlug, integration: "stripe" });
        }
      } else if ("success" in r && r.success) {
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.capture("integration_connected", { org_slug: orgSlug, integration: "stripe" });
        }
        setMessage({ type: "ok", text: "Stripe conectado! A IA agora pode vender seus produtos." });
        setSecretKey("");
        router.refresh();
      }
    });
  }

  async function onDisconnect() {
    setDisconnecting(true);
    setMessage(null);
    const r = await disconnectStripeAction(orgSlug);
    if ("error" in r && r.error) {
      setMessage({ type: "err", text: r.error });
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.captureException(new Error(r.error), { org_slug: orgSlug, integration: "stripe" });
      }
    } else {
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.capture("integration_disconnected", { org_slug: orgSlug, integration: "stripe" });
      }
      setMessage({ type: "ok", text: "Stripe desconectado." });
      setSecretKey("");
    }
    setDisconnecting(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        No{" "}
        <a
          href="https://dashboard.stripe.com/apikeys"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Stripe Dashboard &rarr; API Keys
        </a>{" "}
        copie sua <strong>Secret Key</strong> (sk_live_... ou sk_test_...).
        Cadastre seus produtos diretamente no Stripe e a IA venderá automaticamente.
      </p>
      {!isConnected && (
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="stripe-secret-key">Secret Key</Label>
            <Input
              id="stripe-secret-key"
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="sk_live_... ou sk_test_..."
              autoComplete="new-password"
              data-sensitive
            />
          </div>
          <Button type="submit" disabled={pending || !secretKey}>
            {pending ? "Validando..." : "Conectar Stripe"}
          </Button>
        </form>
      )}
      {isConnected && (
        <div className="border-t pt-4">
          <p className="text-sm text-green-600 dark:text-green-400 mb-3">
            Stripe conectado. Seus produtos serão exibidos automaticamente pelo agente.
          </p>
          <Button type="button" variant="destructive" disabled={disconnecting} onClick={onDisconnect}>
            {disconnecting ? "..." : "Desconectar Stripe"}
          </Button>
        </div>
      )}
      {message && (
        <p
          className={
            message.type === "ok"
              ? "text-sm text-green-600 dark:text-green-400"
              : "text-sm text-destructive"
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
