"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateAgentSettings } from "./actions";
import {
  FOLLOWUP_IDLE_OPTIONS,
  normalizeFollowupIdleMinutes,
} from "@/lib/followup-idle-options";

const PROMPT_PLACEHOLDER = `Você é o assistente virtual da Clínica Exemplo.
Seja cordial, profissional e direto.

## Handoff para humano (opcional)
Além do padrão do Inboxy (cliente pede atendente), transfira também quando:
- o cliente mencionar cancelamento ou reembolso;
- a reclamação for sobre entrega atrasada há mais de 7 dias.

## Roteamento de atendentes
- Cliente pede humano sem especificar → use transfer_to_human sem assignee (fila geral)`;

interface Props {
  orgId: string;
  orgSlug: string;
  initialPrompt: string;
  initialFollowupEnabled: boolean;
  initialFollowupIdleMinutes: number;
}

export function AgentForm({
  orgId,
  orgSlug,
  initialPrompt,
  initialFollowupEnabled,
  initialFollowupIdleMinutes,
}: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [followupEnabled, setFollowupEnabled] = useState(initialFollowupEnabled);
  const [followupIdleMinutes, setFollowupIdleMinutes] = useState(
    normalizeFollowupIdleMinutes(initialFollowupIdleMinutes),
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleSave() {
    startTransition(async () => {
      const result = await updateAgentSettings(orgId, orgSlug, {
        systemPrompt: prompt,
        followupEnabled,
        followupIdleMinutes,
      });
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.captureException(new Error(result.error), { org_slug: orgSlug });
        }
      } else {
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.capture("agent_config_saved", { org_slug: orgSlug });
        }
        setMessage({ type: "success", text: "Configurações salvas." });
      }
      setTimeout(() => setMessage(null), 3000);
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="system-prompt">System Prompt</Label>
        <p className="text-xs text-muted-foreground">
          Define a personalidade, tom de voz e regras do agente. A base de conhecimento é adicionada
          separadamente. A transferência para humano acontece automaticamente quando o cliente pedir —
          você pode definir <strong>outros gatilhos</strong> aqui no prompt.
        </p>
        <Textarea
          id="system-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={12}
          className="font-mono text-sm"
          placeholder={PROMPT_PLACEHOLDER}
        />
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div>
          <h2 className="text-sm font-medium">Reengajamento automático</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Envia uma mensagem contextual quando o lead para de responder após o bot falar por
            último. Funciona dentro da janela de 24h do WhatsApp. Máximo de 1 nudge por conversa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="followup-enabled"
            type="checkbox"
            checked={followupEnabled}
            onChange={(e) => setFollowupEnabled(e.target.checked)}
            className="h-4 w-4 rounded border border-input"
          />
          <Label htmlFor="followup-enabled" className="font-normal">
            Reengajar leads silenciosos
          </Label>
        </div>

        {followupEnabled && (
          <div className="space-y-2">
            <Label htmlFor="followup-idle">Esperar antes de reengajar</Label>
            <select
              id="followup-idle"
              value={followupIdleMinutes}
              onChange={(e) =>
                setFollowupIdleMinutes(normalizeFollowupIdleMinutes(Number(e.target.value)))
              }
              className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {FOLLOWUP_IDLE_OPTIONS.map((option) => (
                <option key={option.minutes} value={option.minutes}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Com follow-up ativo, o agente também pode agendar retornos manuais via tool{" "}
              <code className="rounded bg-muted px-1 py-0.5">schedule_followup</code>.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
        {message && (
          <span className={`text-sm ${message.type === "error" ? "text-destructive" : "text-green-600"}`}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
