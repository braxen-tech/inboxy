"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveChatwootCredentials, disconnectChatwootAction } from "./actions";

interface Props {
  orgSlug: string;
  isConnected: boolean;
  savedApiUrl?: string;
  savedAccountId?: string;
}

export function ChatwootCredentialsForm({
  orgSlug,
  isConnected,
  savedApiUrl = "",
  savedAccountId = "",
}: Props) {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState(savedApiUrl);
  const [accountId, setAccountId] = useState(savedAccountId);
  const [apiToken, setApiToken] = useState("");
  const [pending, startTransition] = useTransition();
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const r = await saveChatwootCredentials({
        orgSlug,
        apiUrl,
        accountId,
        apiToken,
      });
      if ("error" in r && r.error) {
        setMessage({ type: "err", text: r.error });
      } else if ("success" in r && r.success) {
        setMessage({
          type: "ok",
          text: "Conectado ao Chatwoot. Webhook criado automaticamente.",
        });
        setApiToken("");
        router.refresh();
      }
    });
  }

  async function onDisconnect() {
    setDisconnecting(true);
    setMessage(null);
    const r = await disconnectChatwootAction(orgSlug);
    if ("error" in r && r.error) {
      setMessage({ type: "err", text: r.error });
    } else {
      setMessage({ type: "ok", text: "Chatwoot desconectado." });
      setApiUrl("");
      setAccountId("");
      setApiToken("");
    }
    setDisconnecting(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        No Chatwoot, vá em <strong>Settings &rarr; Profile</strong> e copie seu{" "}
        <strong>Access Token</strong>. O <strong>Account ID</strong> aparece na URL
        do Chatwoot (ex: <code>/app/accounts/<strong>1</strong>/...</code>).
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="chatwoot-url">URL do Chatwoot</Label>
          <Input
            id="chatwoot-url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://app.chatwoot.com"
            autoComplete="off"
            readOnly={isConnected}
            className={isConnected ? "bg-muted" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="chatwoot-account-id">Account ID</Label>
          <Input
            id="chatwoot-account-id"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="1"
            autoComplete="off"
            readOnly={isConnected}
            className={isConnected ? "bg-muted" : ""}
          />
        </div>
        {!isConnected && (
          <>
            <div className="space-y-2">
              <Label htmlFor="chatwoot-token">API Access Token</Label>
              <Input
                id="chatwoot-token"
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Cole o token (armazenado de forma criptografada)"
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
            {disconnecting ? "..." : "Desconectar Chatwoot"}
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
