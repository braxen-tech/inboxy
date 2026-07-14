"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { disconnectChannelAction } from "./actions";

interface ChannelRow {
  id: string;
  type: "whatsapp" | "instagram";
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

/**
 * Placeholder UI for channel connections. The Meta Embedded Signup v4 button
 * lives here — when the user completes ES the callback POSTs to
 * `saveChannelConnection` and the row appears in this list.
 */
export function ChannelsCard({ orgSlug, channels }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const activeWhatsApp = channels.find((c) => c.type === "whatsapp" && c.status === "active");
  const activeInstagram = channels.find((c) => c.type === "instagram" && c.status === "active");

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
      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">WhatsApp Business</div>
            {activeWhatsApp ? (
              <div className="text-sm text-muted-foreground">
                {activeWhatsApp.display_name ?? activeWhatsApp.phone_number ?? "Conectado"}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Não conectado</div>
            )}
          </div>
          {activeWhatsApp ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === activeWhatsApp.id}
              onClick={() => disconnect(activeWhatsApp.id)}
            >
              Desconectar
            </Button>
          ) : (
            <Button size="sm" disabled title="Embedded Signup v4 será integrado aqui">
              Conectar
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Instagram DM</div>
            {activeInstagram ? (
              <div className="text-sm text-muted-foreground">
                {activeInstagram.ig_username ? `@${activeInstagram.ig_username}` : activeInstagram.display_name ?? "Conectado"}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Não conectado</div>
            )}
          </div>
          {activeInstagram ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === activeInstagram.id}
              onClick={() => disconnect(activeInstagram.id)}
            >
              Desconectar
            </Button>
          ) : (
            <Button size="sm" disabled title="Embedded Signup v4 será integrado aqui">
              Conectar
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        A conexão via Meta Embedded Signup v4 será habilitada em breve. Após configurar o Meta App
        do Inboxy, o botão &ldquo;Conectar&rdquo; abrirá o fluxo oficial da Meta.
      </p>
    </div>
  );
}
