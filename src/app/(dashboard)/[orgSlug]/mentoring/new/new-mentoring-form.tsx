"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createMentoring } from "../actions";

interface Props {
  orgSlug: string;
}

export function NewMentoringForm({ orgSlug }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("orgSlug", orgSlug);
    startTransition(async () => {
      const result = await createMentoring(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required placeholder="Ex: Mentoria de 1 hora" maxLength={200} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Textarea id="description" name="description" placeholder="O que o aluno vai aprender na mentoria..." rows={4} maxLength={2000} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="thumbnail">Imagem (opcional)</Label>
        <Input id="thumbnail" name="thumbnail" type="file" accept="image/jpeg,image/png,image/webp" />
        <p className="text-xs text-muted-foreground">JPG, PNG ou WebP · máx. 5 MB</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="priceBrl">Preço (R$)</Label>
        <Input id="priceBrl" name="priceBrl" type="number" min="0" step="0.01" required placeholder="297.00" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bookingQuota">Sessões incluídas</Label>
        <Input id="bookingQuota" name="bookingQuota" type="number" min="1" max="100" defaultValue="1" />
        <p className="text-xs text-muted-foreground">Quantas sessões o aluno pode agendar após o pagamento.</p>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando..." : "Criar mentoria →"}
      </Button>
    </form>
  );
}
