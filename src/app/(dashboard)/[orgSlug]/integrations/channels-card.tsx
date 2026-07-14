"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { disconnectChannelAction } from "./actions";
import { EmbeddedSignupButton } from "./embedded-signup";

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
            <EmbeddedSignupButton orgSlug={orgSlug} variant="whatsapp" />
          )}
        </div>
      </div>

      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Instagram DM</div>
            {activeInstagram ? (
              <div className="text-sm text-muted-foreground">
                {activeInstagram.ig_username
                  ? `@${activeInstagram.ig_username}`
                  : activeInstagram.display_name ?? "Conectado"}
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
            <EmbeddedSignupButton orgSlug={orgSlug} variant="instagram" />
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        A conexão usa o fluxo oficial <strong>Meta Embedded Signup v4</strong>. Ao clicar em
        &ldquo;Conectar&rdquo;, você entra com sua conta do Facebook Business e autoriza o Inboxy a
        atender mensagens neste canal.
      </p>
    </div>
  );
}
