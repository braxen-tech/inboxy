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

## Tags de lead
Crie tags antes em Ajustes → Tags, depois defina aqui as regras:
- Exemplos: "cliente pergunta preço → aplicar tag X", "cliente diz que não quer → aplicar tag Y e remover tag X"
- Se precisar remover uma tag antes de aplicar outra, use a ferramenta duas vezes: remova "X", depois adicione "Y"
- Você controla quais tags usar — não há tags pré-definidas obrigatórias

## CRM / Contato
Quando o cliente informar nome completo e e-mail:
- Chame update_contact com name, email e notas
- Note resumindo interesse e próximo passo

## Roteamento de atendentes
Use os nomes exatos dos atendentes cadastrados na organização:
- Assuntos financeiros → transferir para "Ana Silva"
- Suporte técnico → transferir para "Carlos Mendes"
- Cliente pede humano sem especificar → transferir sem assignee (fila geral)`;

interface Props {
  orgId: string;
  orgSlug: string;
  initialPrompt: string;
  initialFollowupEnabled: boolean;
  initialFollowupIdleMinutes: number;
  hasActiveChannel: boolean;
  availableTags?: string[];
  availableAgents?: { name: string; email: string }[];
}

export function AgentForm({
  orgId,
  orgSlug,
  initialPrompt,
  initialFollowupEnabled,
  initialFollowupIdleMinutes,
  hasActiveChannel,
  availableTags = [],
  availableAgents = [],
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
          separadamente.
          {hasActiveChannel && (
            <>
              {" "}
              Com um canal conectado, a transferência para humano acontece automaticamente quando o
              cliente pedir — e você pode definir <strong>outros gatilhos</strong> aqui no prompt (ex.:
              cancelamento, reclamações graves). Também pode definir <strong>regras de tags</strong>{" "}
              para classificar leads nas conversas (tags devem existir na organização) e{" "}
              <strong>roteamento para atendentes</strong> específicos pelo nome.
            </>
          )}
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

      {hasActiveChannel && (
        <div className="space-y-2">
          <Label>Tags disponíveis</Label>
          {availableTags.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Tags cadastradas:{" "}
              {availableTags.map((tag) => (
                <code key={tag} className="mr-1 rounded bg-muted px-1 py-0.5">
                  {tag}
                </code>
              ))}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhuma tag cadastrada. Crie em Ajustes → Tags antes de referenciá-las no prompt.
            </p>
          )}
        </div>
      )}

      {hasActiveChannel && (
        <div className="space-y-2">
          <Label>Atendentes</Label>
          {availableAgents.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Atendentes disponíveis:{" "}
              {availableAgents.map((agent) => (
                <code key={agent.email} className="mr-1 rounded bg-muted px-1 py-0.5">
                  {agent.name}
                </code>
              ))}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhum atendente encontrado. Convide membros com role admin ou agent antes de referenciá-los
              no prompt.
            </p>
          )}
        </div>
      )}

      {hasActiveChannel && (
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
      )}

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
