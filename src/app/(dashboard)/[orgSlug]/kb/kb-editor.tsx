"use client";

import { useState, useTransition } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateKnowledgeBase } from "./actions";

interface Props {
  orgId: string;
  orgSlug: string;
  initialValue: string;
}

export function KbEditor({ orgId, orgSlug, initialValue }: Props) {
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const charCount = value.length;
  const tokenEstimate = Math.ceil(charCount / 4);

  function handleSave() {
    startTransition(async () => {
      const result = await updateKnowledgeBase(orgId, orgSlug, value);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Knowledge base salva com sucesso." });
      }
      setTimeout(() => setMessage(null), 3000);
    });
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={20}
        className="font-mono text-sm"
        placeholder={"# Nome da Clínica\n\n## Serviços\n- Consulta geral\n- Limpeza dental\n\n## Horários\nSegunda a sexta, 8h às 18h.\n\n## Endereço\nRua Exemplo, 123"}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {charCount.toLocaleString()} caracteres · ~{tokenEstimate.toLocaleString()} tokens
          {tokenEstimate > 40000 && (
            <span className="text-destructive ml-2">
              ⚠ KB grande — considere migrar para RAG em breve
            </span>
          )}
        </span>
        <div className="flex items-center gap-3">
          {message && (
            <span className={`text-sm ${message.type === "error" ? "text-destructive" : "text-green-600"}`}>
              {message.text}
            </span>
          )}
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
