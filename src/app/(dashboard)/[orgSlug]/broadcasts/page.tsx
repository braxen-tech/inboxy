import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Mail } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getOrgBySlug } from "@/lib/get-org";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function BroadcastsPage({ params }: Props) {
  const { orgSlug } = await params;
  const [org, t] = await Promise.all([
    getOrgBySlug(orgSlug),
    getTranslations("broadcasts"),
  ]);
  if (!org) notFound();

  const statusLabels: Record<string, { label: string; className: string }> = {
    draft: { label: t("draft"), className: "bg-muted text-muted-foreground" },
    sending: { label: t("sending"), className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    sent: { label: t("sent"), className: "bg-green-500/15 text-green-700 dark:text-green-400" },
    failed: { label: t("failed"), className: "bg-red-500/15 text-red-700 dark:text-red-400" },
  };

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
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("description")}</p>
        </div>
        <Link href={`/${orgSlug}/broadcasts/new`}>
          <Button className="gap-2">
            <Plus className="size-4" />
            {t("new")}
          </Button>
        </Link>
      </div>

      {!broadcasts || broadcasts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted mb-4">
              <Mail className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">{t("empty")}</p>
            <Link href={`/${orgSlug}/broadcasts/new`} className="mt-4">
              <Button variant="outline" className="gap-2">
                <Plus className="size-4" />
                {t("createFirst")}
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
                      {b.status === "sent" && ` · ${b.recipient_count}`}
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
