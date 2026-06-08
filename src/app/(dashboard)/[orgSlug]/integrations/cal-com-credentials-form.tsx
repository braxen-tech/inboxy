"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCalComCredentials, disconnectCalComAction } from "./actions";

interface Props {
  orgSlug: string;
  isConnected: boolean;
  savedEventTypeId?: string;
  savedTimezone?: string;
  savedBookingUrl?: string;
}

export function CalComCredentialsForm({
  orgSlug,
  isConnected,
  savedEventTypeId = "",
  savedTimezone = "America/Sao_Paulo",
  savedBookingUrl = "",
}: Props) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [eventTypeId, setEventTypeId] = useState(savedEventTypeId);
  const [timezone, setTimezone] = useState(savedTimezone);
  const [bookingUrl, setBookingUrl] = useState(savedBookingUrl);
  const [pending, startTransition] = useTransition();
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const r = await saveCalComCredentials({
        orgSlug,
        apiKey,
        eventTypeId,
        timezone,
        bookingUrl,
      });
      if ("error" in r && r.error) {
        setMessage({ type: "err", text: r.error });
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.captureException(new Error(r.error), { org_slug: orgSlug, integration: "cal_com" });
        }
      } else if ("success" in r && r.success) {
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.capture("integration_connected", { org_slug: orgSlug, integration: "cal_com" });
        }
        setMessage({ type: "ok", text: "Cal.com conectado com sucesso! A IA pode agora agendar consultas." });
        setApiKey("");
        router.refresh();
      }
    });
  }

  async function onDisconnect() {
    setDisconnecting(true);
    setMessage(null);
    const r = await disconnectCalComAction(orgSlug);
    if ("error" in r && r.error) {
      setMessage({ type: "err", text: r.error });
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.captureException(new Error(r.error), { org_slug: orgSlug, integration: "cal_com" });
      }
    } else {
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        posthog.capture("integration_disconnected", { org_slug: orgSlug, integration: "cal_com" });
      }
      setMessage({ type: "ok", text: "Cal.com desconectado." });
      setApiKey("");
      setEventTypeId("");
      setBookingUrl("");
    }
    setDisconnecting(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        No{" "}
        <a
          href="https://app.cal.com/settings/developer/api-keys"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Cal.com Settings &rarr; API Keys
        </a>{" "}
        gere uma API key. O <strong>Event Type ID</strong> está na URL do tipo de evento
        (ex.: <code>cal.com/event-types/123</code> &rarr; ID = 123).
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="cal-event-type-id">Event Type ID</Label>
          <Input
            id="cal-event-type-id"
            value={eventTypeId}
            onChange={(e) => setEventTypeId(e.target.value)}
            placeholder="123"
            autoComplete="off"
            readOnly={isConnected}
            className={isConnected ? "bg-muted" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cal-timezone">Fuso horário</Label>
          <Input
            id="cal-timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="America/Sao_Paulo"
            autoComplete="off"
            readOnly={isConnected}
            className={isConnected ? "bg-muted" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cal-booking-url">Link público de agendamento (opcional)</Label>
          <Input
            id="cal-booking-url"
            value={bookingUrl}
            onChange={(e) => setBookingUrl(e.target.value)}
            placeholder="https://cal.com/sua-clinica/consulta"
            autoComplete="off"
            readOnly={isConnected}
            className={isConnected ? "bg-muted" : ""}
          />
        </div>
        {!isConnected && (
          <>
            <div className="space-y-2">
              <Label htmlFor="cal-api-key">API Key</Label>
              <Input
                id="cal-api-key"
                type="password"
                value={apiKey}
                data-sensitive
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="cal_live_..."
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Validando..." : "Conectar Cal.com"}
            </Button>
          </>
        )}
      </form>
      {isConnected && (
        <div className="border-t pt-4">
          <Button type="button" variant="destructive" disabled={disconnecting} onClick={onDisconnect}>
            {disconnecting ? "..." : "Desconectar Cal.com"}
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
