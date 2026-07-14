"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { KbAgentTestOutput } from "@/application/services/test-kb-agent";
import { testKbAgent } from "./actions";

interface Props {
  orgSlug: string;
  hasReadyDocuments: boolean;
  hasManualKb: boolean;
}

function ChunkList({
  title,
  chunks,
}: {
  title: string;
  chunks: KbAgentTestOutput["directChunks"];
}) {
  if (chunks.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground italic">Nenhum trecho encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="space-y-2">
        {chunks.map((chunk, index) => (
          <div key={`${chunk.documentTitle}-${index}`} className="rounded-md border bg-muted/30 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium truncate">{chunk.documentTitle}</span>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {chunk.score.toFixed(2)}
              </Badge>
            </div>
            <p className="text-xs whitespace-pre-wrap line-clamp-4">{chunk.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KbAgentTest({ orgSlug, hasReadyDocuments, hasManualKb }: Props) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<KbAgentTestOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canTest = hasReadyDocuments || hasManualKb;

  function handleSubmit() {
    setError(null);
    setResult(null);

    startTransition(async () => {
      const outcome = await testKbAgent(orgSlug, question);
      if (outcome.error) {
        setError(outcome.error);
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.captureException(new Error(outcome.error), { org_slug: orgSlug });
        }
        return;
      }

      if (outcome.result) {
        setResult(outcome.result);
        if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.capture("kb_agent_test_completed", {
            org_slug: orgSlug,
            used_lookup_knowledge: outcome.result.usedLookupKnowledge,
          });
        }
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Testar agente</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Simule uma pergunta de cliente e veja a resposta da IA, incluindo se ela consultou os
          documentos indexados. Não envia mensagem real e não consome cota.
        </p>
      </div>

      {!canTest && (
        <p className="text-sm text-muted-foreground">
          Adicione texto manual ou envie documentos indexados para habilitar o teste.
        </p>
      )}

      <Textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={3}
        disabled={!canTest || isPending}
        placeholder="Ex.: Qual o horário de funcionamento da clínica?"
        className="text-sm"
      />

      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={!canTest || isPending || !question.trim()}>
          {isPending ? "Consultando..." : "Perguntar"}
        </Button>
        {hasReadyDocuments && (
          <span className="text-xs text-muted-foreground">
            Busca semântica ativa · documentos indexados
          </span>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="space-y-4 border rounded-lg p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">Resposta da IA</p>
              {result.hasIndexedDocuments && (
                <Badge variant={result.usedLookupKnowledge ? "default" : "secondary"}>
                  {result.usedLookupKnowledge
                    ? "Consultou documentos"
                    : "Não consultou documentos"}
                </Badge>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/40 p-3">{result.reply}</p>
            <p className="text-xs text-muted-foreground">
              {result.inputTokens + result.outputTokens} tokens · {result.inputTokens} in /{" "}
              {result.outputTokens} out
            </p>
          </div>

          {result.hasIndexedDocuments && (
            <>
              <ChunkList title="Trechos encontrados (busca direta com sua pergunta)" chunks={result.directChunks} />

              {result.lookupCalls.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Consultas feitas pelo agente via lookup_knowledge
                  </p>
                  {result.lookupCalls.map((call, index) => (
                    <div key={`${call.query}-${index}`} className="space-y-2 pl-3 border-l-2">
                      <p className="text-xs">
                        Query: <span className="font-medium">{call.query}</span>
                      </p>
                      <ChunkList title={`Trechos retornados (${call.chunks.length})`} chunks={call.chunks} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
