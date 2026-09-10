import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Mail } from "lucide-react";
import { getOrgBySlug } from "@/lib/get-org";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  sending: { label: "Enviando...", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  sent: { label: "Enviado", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  failed: { label: "Falhou", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
};

export default async function BroadcastsPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = getAdminClient();
  const { data: broadcasts } = await db
    .from("email_broadcasts")
    .select("id, subject, status, recipient_count, sent_at, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Emails</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envie emails para toda sua base de alunos e compradores
          </p>
        </div>
        <Link href={`/${orgSlug}/broadcasts/new`}>
          <Button className="gap-2">
            <Plus className="size-4" />
            Novo email
          </Button>
        </Link>
      </div>

      {!broadcasts || broadcasts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted mb-4">
              <Mail className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhum email enviado ainda</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crie seu primeiro email para se comunicar com sua base
            </p>
            <Link href={`/${orgSlug}/broadcasts/new`} className="mt-4">
              <Button variant="outline" className="gap-2">
                <Plus className="size-4" />
                Criar primeiro email
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((b) => {
            const s = statusLabels[b.status] ?? statusLabels.draft;
            return (
              <Card key={b.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{b.subject}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.sent_at
                        ? new Date(b.sent_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                        : new Date(b.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      {b.status === "sent" && ` · ${b.recipient_count} destinatário${b.recipient_count === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <Badge variant="secondary" className={s.className}>
                    {s.label}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
