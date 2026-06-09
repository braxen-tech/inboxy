"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateAgentSettings } from "./actions";

const MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (recomendado)" },
  { value: "claude-haiku-3-5-20241022", label: "Claude Haiku 3.5 (mais rápido/barato)" },
];

const PROMPT_PLACEHOLDER = `Você é o assistente virtual da Clínica Exemplo.
Seja cordial, profissional e direto.

## Handoff para humano (opcional)
Além do padrão do Inboxy (cliente pede atendente), transfira também quando:
- o cliente mencionar cancelamento ou reembolso;
- a reclamação for sobre entrega atrasada há mais de 7 dias.`;

interface Props {
  orgId: string;
  orgSlug: string;
  initialPrompt: string;
  initialModel: string;
  chatwootActive: boolean;
}

export function AgentForm({ orgId, orgSlug, initialPrompt, initialModel, chatwootActive }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [model, setModel] = useState(initialModel);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleSave() {
    startTransition(async () => {
      const result = await updateAgentSettings(orgId, orgSlug, {
        systemPrompt: prompt,
        model,
      });
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.captureException(new Error(result.error), { org_slug: orgSlug, model });
        }
      } else {
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.capture("agent_config_saved", { org_slug: orgSlug, model });
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
          {chatwootActive && (
            <>
              {" "}
              Com Chatwoot conectado, a transferência para humano acontece automaticamente quando o
              cliente pedir — e você pode definir <strong>outros gatilhos</strong> aqui no prompt (ex.:
              cancelamento, reclamações graves).
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

      <div className="space-y-2">
        <Label htmlFor="model">Modelo de IA</Label>
        <select
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          {MODELS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
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
