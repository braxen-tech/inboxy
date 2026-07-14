"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { disconnectChannelAction } from "./actions";
import { EmbeddedSignupButton } from "./embedded-signup";
import { TelegramConnectForm } from "./telegram-connect-form";

export interface ChannelRow {
  id: string;
  type: "whatsapp" | "instagram" | "telegram";
  status: string;
  phone_number: string | null;
  display_name: string | null;
  ig_username: string | null;
  connected_at: string | null;
}

interface Props {
  orgSlug: string;
  channels: ChannelRow[];
}

function activeOf(channels: ChannelRow[], type: ChannelRow["type"]) {
  return channels.find((c) => c.type === type && c.status === "active");
}

export function ChannelsPanel({ orgSlug, channels }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const wa = activeOf(channels, "whatsapp");
  const ig = activeOf(channels, "instagram");
  const tg = activeOf(channels, "telegram");

  async function disconnect(id: string) {
    setBusy(id);
    try {
      await disconnectChannelAction(orgSlug, id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <ChannelBlock
        title="WhatsApp Business"
        subtitle={
          wa
            ? (wa.display_name ?? wa.phone_number ?? "Conectado")
            : "Não conectado"
        }
        connected={Boolean(wa)}
        onDisconnect={wa ? () => disconnect(wa.id) : undefined}
        busy={wa ? busy === wa.id : false}
        connectSlot={<EmbeddedSignupButton orgSlug={orgSlug} variant="whatsapp" />}
        hint="Conexão via Meta Embedded Signup."
      />

      <ChannelBlock
        title="Instagram DM"
        subtitle={
          ig
            ? ig.ig_username
              ? `@${ig.ig_username}`
              : (ig.display_name ?? "Conectado")
            : "Não conectado"
        }
        connected={Boolean(ig)}
        onDisconnect={ig ? () => disconnect(ig.id) : undefined}
        busy={ig ? busy === ig.id : false}
        connectSlot={<EmbeddedSignupButton orgSlug={orgSlug} variant="instagram" />}
        hint="Conexão via Meta Embedded Signup (requer permissões Instagram)."
      />

      <ChannelBlock
        title="Telegram"
        subtitle={tg ? (tg.display_name ?? "Conectado") : "Não conectado"}
        connected={Boolean(tg)}
        onDisconnect={tg ? () => disconnect(tg.id) : undefined}
        busy={tg ? busy === tg.id : false}
        connectSlot={<TelegramConnectForm orgSlug={orgSlug} />}
        hint="Cole o token do @BotFather. Estilo Chatwoot — um bot por organização."
      />
    </div>
  );
}

function ChannelBlock({
  title,
  subtitle,
  connected,
  onDisconnect,
  busy,
  connectSlot,
  hint,
}: {
  title: string;
  subtitle: string;
  connected: boolean;
  onDisconnect?: () => void;
  busy: boolean;
  connectSlot: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </div>
        {connected && onDisconnect ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onDisconnect}>
            {busy ? "..." : "Desconectar"}
          </Button>
        ) : null}
      </div>
      {!connected ? <div>{connectSlot}</div> : null}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
