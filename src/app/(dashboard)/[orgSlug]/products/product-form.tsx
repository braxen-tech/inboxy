"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDigitalProduct } from "./actions";

interface Props {
  orgSlug: string;
  onSuccess?: () => void;
}

export function ProductForm({ orgSlug, onSuccess }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    formData.set("orgSlug", orgSlug);

    startTransition(async () => {
      const r = await createDigitalProduct(formData);
      if ("error" in r && r.error) {
        setMessage({ type: "err", text: r.error });
      } else {
        setMessage({ type: "ok", text: "Produto criado com sucesso!" });
        formRef.current?.reset();
        router.refresh();
        onSuccess?.();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required placeholder="E-book de Marketing Digital" maxLength={200} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Textarea id="description" name="description" placeholder="Breve descrição do produto..." rows={3} maxLength={2000} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">Arquivo</Label>
        <Input id="file" name="file" type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.jpg,.jpeg,.png,.mp3,.mp4" />
        <p className="text-xs text-muted-foreground">PDF, Word, Excel, ZIP, imagens, áudio ou vídeo · máx. 100 MB</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priceBrl">Preço (R$)</Label>
          <Input id="priceBrl" name="priceBrl" type="number" min="0" step="0.01" required placeholder="49.90" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="paymentType">Tipo de pagamento</Label>
          <select id="paymentType" name="paymentType" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="one_time">Pagamento único</option>
            <option value="recurring">Recorrente</option>
          </select>
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Enviando..." : "Criar produto"}
      </Button>

      {message && (
        <p className={message.type === "ok" ? "text-sm text-green-600 dark:text-green-400" : "text-sm text-destructive"}>
          {message.text}
        </p>
      )}
    </form>
  );
}
