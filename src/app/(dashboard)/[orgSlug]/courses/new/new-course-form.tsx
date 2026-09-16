"use client";

import { useTransition, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCourse } from "../actions";

interface Props {
  orgSlug: string;
}

export function NewCourseForm({ orgSlug }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [paymentType, setPaymentType] = useState<"one_time" | "recurring">("one_time");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("orgSlug", orgSlug);
    startTransition(async () => { await createCourse(formData); });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Título do curso</Label>
        <Input id="title" name="title" required placeholder="Ex: Marketing Digital do Zero" maxLength={200} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Textarea id="description" name="description" placeholder="O que o aluno vai aprender..." rows={4} maxLength={2000} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="thumbnail">Capa do curso (opcional)</Label>
        <Input id="thumbnail" name="thumbnail" type="file" accept="image/jpeg,image/png,image/webp" />
        <p className="text-xs text-muted-foreground">JPG, PNG ou WebP · máx. 5 MB · proporção 16:9 recomendada</p>
      </div>

      <div className="space-y-2">
        <Label>Tipo de cobrança</Label>
        <div className="flex gap-3">
          <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${paymentType === "one_time" ? "border-primary bg-primary/5" : "border-border"}`}>
            <input
              type="radio"
              name="paymentType"
              value="one_time"
              checked={paymentType === "one_time"}
              onChange={() => setPaymentType("one_time")}
              className="sr-only"
            />
            <div>
              <p className="text-sm font-medium">Pagamento único</p>
              <p className="text-xs text-muted-foreground">Acesso vitalício após compra</p>
            </div>
          </label>
          <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${paymentType === "recurring" ? "border-primary bg-primary/5" : "border-border"}`}>
            <input
              type="radio"
              name="paymentType"
              value="recurring"
              checked={paymentType === "recurring"}
              onChange={() => setPaymentType("recurring")}
              className="sr-only"
            />
            <div>
              <p className="text-sm font-medium">Assinatura mensal</p>
              <p className="text-xs text-muted-foreground">Acesso enquanto ativo</p>
            </div>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="priceBrl">{paymentType === "recurring" ? "Preço mensal (R$)" : "Preço (R$)"}</Label>
        <Input id="priceBrl" name="priceBrl" type="number" min="0" step="0.01" required placeholder={paymentType === "recurring" ? "47.00" : "197.00"} />
        <p className="text-xs text-muted-foreground">
          {paymentType === "recurring"
            ? "Cobrado mensalmente. Aluno perde acesso ao cancelar."
            : "Use 0 para disponibilizar gratuitamente."}
        </p>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando..." : "Criar curso e adicionar aulas →"}
      </Button>
    </form>
  );
}
