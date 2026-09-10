"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Send, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAndSendBroadcast } from "../actions";

interface Props {
  orgSlug: string;
  recipientCount: number;
}

export function BroadcastForm({ orgSlug, recipientCount }: Props) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ sent: number; failed: number } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (recipientCount === 0) return;

    setSending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("orgSlug", orgSlug);

    const result = await createAndSendBroadcast(formData);

    if ("error" in result && result.error) {
      setError(result.error);
      setSending(false);
    } else if ("success" in result) {
      setSuccess({ sent: result.sent ?? 0, failed: result.failed ?? 0 });
      setSending(false);
    }
  }

  if (success) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-green-500/15 mb-4">
            <Send className="size-6 text-green-600" />
          </div>
          <p className="font-semibold text-lg">Email enviado!</p>
          <p className="text-sm text-muted-foreground mt-1">
            {success.sent} email{success.sent === 1 ? "" : "s"} enviado{success.sent === 1 ? "" : "s"} com sucesso
            {success.failed > 0 && `, ${success.failed} falha${success.failed === 1 ? "" : "s"}`}
          </p>
          <Link href={`/${orgSlug}/broadcasts`} className="mt-6">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="size-4" />
              Voltar para emails
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Compor email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="subject" className="text-sm font-medium">
              Assunto
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              required
              maxLength={200}
              placeholder="Ex: Novidade para vocês!"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="bodyHtml" className="text-sm font-medium">
              Conteúdo do email
            </label>
            <textarea
              id="bodyHtml"
              name="bodyHtml"
              required
              rows={12}
              placeholder="Escreva o conteúdo do email aqui..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Você pode usar HTML para formatação. O conteúdo será enviado como está.
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <Link href={`/${orgSlug}/broadcasts`}>
          <Button type="button" variant="ghost" className="gap-2">
            <ArrowLeft className="size-4" />
            Cancelar
          </Button>
        </Link>
        <Button type="submit" disabled={sending || recipientCount === 0} className="gap-2">
          <Send className="size-4" />
          {sending ? "Enviando..." : `Enviar para ${recipientCount} destinatário${recipientCount === 1 ? "" : "s"}`}
        </Button>
      </div>
    </form>
  );
}
