"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { disconnectWhatsApp, saveWhatsAppCredentials } from "./actions";

interface Props {
  orgSlug: string;
  isConnected: boolean;
  savedWabaId?: string;
  savedPhoneNumberId?: string;
}

export function WhatsAppCredentialsForm({
  orgSlug,
  isConnected,
  savedWabaId = "",
  savedPhoneNumberId = "",
}: Props) {
  const router = useRouter();
  const [wabaId, setWabaId] = useState(savedWabaId);
  const [phoneNumberId, setPhoneNumberId] = useState(savedPhoneNumberId);
  const [accessToken, setAccessToken] = useState("");
  const [pending, startTransition] = useTransition();
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const r = await saveWhatsAppCredentials({
        orgSlug,
        wabaId,
        phoneNumberId,
        accessToken,
      });
      if ("error" in r && r.error) {
        setMessage({ type: "err", text: r.error });
      } else if ("success" in r && r.success) {
        setMessage({
          type: "ok",
          text: `Conectado. Número: ${r.phone}. Webhook já deve estar apontando para este app.`,
        });
        setAccessToken("");
        router.refresh();
      }
    });
  }

  async function onDisconnect() {
    setDisconnecting(true);
    setMessage(null);
    const r = await disconnectWhatsApp(orgSlug);
    if ("error" in r && r.error) {
      setMessage({ type: "err", text: r.error });
    } else {
      setMessage({ type: "ok", text: "WhatsApp desconectado nesta organização." });
      setWabaId("");
      setPhoneNumberId("");
      setAccessToken("");
    }
    setDisconnecting(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        No{" "}
        <a
          href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started#get-a-temporary-access-token"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Meta for Developers
        </a>{" "}
        abra seu app WhatsApp Cloud API → copie o <strong>WhatsApp Business Account ID</strong>,{" "}
        <strong>Phone number ID</strong> e use um{" "}
        <strong className="text-foreground">
          token de usuário do sistema (&quot;nunca expira&quot;)
        </strong>{" "}
        sempre que possível (Meta Business Suite → Usuários do sistema → token com permissões do app).
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="waba-id">WhatsApp Business Account ID (WABA)</Label>
          <Input
            id="waba-id"
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            placeholder="123456789012345"
            autoComplete="off"
            readOnly={isConnected}
            className={isConnected ? "bg-muted" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone-number-id">Phone number ID</Label>
          <Input
            id="phone-number-id"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="987654321098765"
            autoComplete="off"
            readOnly={isConnected}
            className={isConnected ? "bg-muted" : ""}
          />
        </div>
        {!isConnected && (
          <>
            <div className="space-y-2">
              <Label htmlFor="access-token">Access token</Label>
              <Input
                id="access-token"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Cole o token (nunca é armazenado em texto plano na base)"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Validando..." : "Salvar e conectar"}
            </Button>
          </>
        )}
      </form>
      {isConnected && (
        <div className="border-t pt-4">
          <Button type="button" variant="destructive" disabled={disconnecting} onClick={onDisconnect}>
            {disconnecting ? "..." : "Desconectar WhatsApp"}
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
