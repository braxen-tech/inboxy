"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveChatwootCredentials, disconnectChatwootAction } from "./actions";

interface InboxSummary {
  id: number;
  name: string;
}

interface Props {
  orgSlug: string;
  isConnected: boolean;
  savedApiUrl?: string;
  savedAccountId?: string;
  savedAgentBotId?: string;
  agentBotWebhookUrl?: string | null;
  hasBotAccessToken?: boolean;
}

export function ChatwootCredentialsForm({
  orgSlug,
  isConnected,
  savedApiUrl = "",
  savedAccountId = "",
  savedAgentBotId = "",
  agentBotWebhookUrl = null,
  hasBotAccessToken = true,
}: Props) {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState(savedApiUrl);
  const [accountId, setAccountId] = useState(savedAccountId);
  const [apiToken, setApiToken] = useState("");
  const [webhookUrl, setWebhookUrl] = useState(agentBotWebhookUrl ?? "");
  const [botId, setBotId] = useState(savedAgentBotId);
  const [linkedInboxes, setLinkedInboxes] = useState<InboxSummary[]>([]);
  const [failedInboxes, setFailedInboxes] = useState<
    { id: number; name: string; error: string }[]
  >([]);
  const [pending, startTransition] = useTransition();
  const [disconnecting, setDisconnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (agentBotWebhookUrl) setWebhookUrl(agentBotWebhookUrl);
    if (savedAgentBotId) setBotId(savedAgentBotId);
  }, [agentBotWebhookUrl, savedAgentBotId]);

  function copyWebhookUrl() {
    if (!webhookUrl) return;
    void navigator.clipboard.writeText(webhookUrl);
    setMessage({ type: "ok", text: "URL copiada." });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const r = await saveChatwootCredentials({ orgSlug, apiUrl, accountId, apiToken });
      if ("error" in r && r.error) {
        setMessage({ type: "err", text: r.error });
      } else if ("success" in r && r.success) {
        if (r.agentBotWebhookUrl) setWebhookUrl(r.agentBotWebhookUrl);
        if (r.botId != null) setBotId(String(r.botId));
        if (r.linkedInboxes) setLinkedInboxes(r.linkedInboxes);
        if (r.failedInboxes) setFailedInboxes(r.failedInboxes);

        const linked = r.linkedInboxes?.length ?? 0;
        const failed = r.failedInboxes?.length ?? 0;
        const tokenNote =
          r.hasBotAccessToken === false
            ? " Atenção: token do Agent Bot não foi obtido — reconecte ou verifique permissões de admin."
            : "";
        setMessage({
          type: r.hasBotAccessToken === false ? "err" : "ok",
          text:
            (failed > 0
              ? `Chatwoot conectado. Bot ID ${r.botId}. ${linked} inbox(es) vinculado(s); ${failed} falhou(aram).`
              : `Chatwoot conectado. Bot ID ${r.botId} vinculado a ${linked} inbox(es).`) + tokenNote,
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
      setBotId("");
      setWebhookUrl("");
      setLinkedInboxes([]);
      setFailedInboxes([]);
    }
    setDisconnecting(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-sm space-y-2">
        <p className="font-medium">Chatwoot + Agent Bot (automático)</p>
        <p className="text-muted-foreground text-xs">
          Ao conectar, o Inboxy cria o Agent Bot no Chatwoot, vincula todos os inboxes existentes
          e registra webhook para novos canais. Handoff: <strong>pending</strong> = IA ·{" "}
          <strong>open</strong> = humano.
        </p>
        <p className="text-xs text-muted-foreground">
          Use um API Access Token de <strong>administrador</strong> da conta Chatwoot.
        </p>
        <p className="text-xs text-muted-foreground border-t pt-2">
          No painel: bot em <strong>Pending</strong>; após handoff, <strong>Open</strong> → aba{" "}
          <strong>Unassigned</strong> ou <strong>All</strong>.
        </p>
        <a
          href="https://www.chatwoot.com/hc/user-guide/articles/1677497472-how-to-use-agent-bots"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline text-xs"
        >
          Documentação Chatwoot — Agent bots
        </a>
      </div>

      {!isConnected ? (
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="chatwoot-url">URL do Chatwoot</Label>
            <Input
              id="chatwoot-url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://app.chatwoot.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chatwoot-account-id">Account ID</Label>
            <Input
              id="chatwoot-account-id"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="Número na URL: /app/accounts/123/..."
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chatwoot-token">API Access Token</Label>
            <Input
              id="chatwoot-token"
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Settings → Profile → Access Token"
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Configurando bot e inboxes..." : "Conectar Chatwoot"}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          {!hasBotAccessToken && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-100">
              As respostas estão saindo como <strong>agente humano</strong>, não como Agent Bot — por
              isso o painel do Chatwoot pode ficar vazio. Clique em <strong>Reconectar</strong> abaixo
              (token de admin) para regenerar o token do bot.
            </div>
          )}
          <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
            <p>
              <strong>URL</strong> {savedApiUrl} · <strong>Account</strong> {savedAccountId}
            </p>
            {savedAgentBotId && (
              <p>
                <strong>Agent Bot ID</strong> <span className="font-mono">{savedAgentBotId}</span>
              </p>
            )}
          </div>

          {webhookUrl && (
            <div className="space-y-2">
              <Label>Outgoing URL (Agent Bot no Chatwoot)</Label>
              <div className="flex gap-2">
                <Input readOnly value={webhookUrl} className="font-mono text-xs bg-muted" />
                <Button type="button" variant="outline" onClick={copyWebhookUrl}>
                  Copiar
                </Button>
              </div>
            </div>
          )}

          {(linkedInboxes.length > 0 || isConnected) && (
            <p className="text-xs text-muted-foreground">
              Novos inboxes no Chatwoot são vinculados ao bot automaticamente.
            </p>
          )}

          {failedInboxes.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-1">
              <p className="font-medium text-amber-950 dark:text-amber-100">
                Alguns inboxes não foram vinculados
              </p>
              <ul className="list-disc pl-4 text-muted-foreground">
                {failedInboxes.map((i) => (
                  <li key={i.id}>
                    {i.name} (ID {i.id}): {i.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t pt-4">
            <Button
              type="button"
              variant="destructive"
              disabled={disconnecting}
              onClick={onDisconnect}
            >
              {disconnecting ? "..." : "Desconectar Chatwoot"}
            </Button>
          </div>
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
