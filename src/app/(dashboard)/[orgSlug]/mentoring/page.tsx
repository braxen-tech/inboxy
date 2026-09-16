import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getOrgBySlug } from "@/lib/get-org";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

function formatBrl(value: number | null, freeLabel: string): string {
  if (value == null) return freeLabel;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function MentoringPage({ params }: Props) {
  const { orgSlug } = await params;
  const [org, t, tc] = await Promise.all([
    getOrgBySlug(orgSlug),
    getTranslations("mentoring"),
    getTranslations("common"),
  ]);
  if (!org) notFound();

  const db = getAdminClient();

  // Fetch courses that have at least one mentoring lesson
  const { data: mentoringLessons } = await db
    .from("course_lessons")
    .select("module_id")
    .eq("lesson_type", "mentoring");

  const moduleIds = (mentoringLessons ?? []).map((l) => l.module_id);

  let courses: { id: string; title: string; description: string | null; price_brl: number | null; active: boolean; created_at: string }[] = [];

  if (moduleIds.length > 0) {
    const { data: modules } = await db
      .from("course_modules")
      .select("course_id")
      .in("id", moduleIds);

    const courseIds = [...new Set((modules ?? []).map((m) => m.course_id))];

    if (courseIds.length > 0) {
      const { data } = await db
        .from("courses")
        .select("id, title, description, price_brl, active, created_at")
        .eq("organization_id", org.id)
        .in("id", courseIds)
        .order("created_at", { ascending: false });
      courses = data ?? [];
    }
  }

  const calConnected = !!org.cal_event_type_id;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("description")}</p>
        </div>
        {calConnected ? (
          <Link href={`/${orgSlug}/mentoring/new`}>
            <Button>{t("new")}</Button>
          </Link>
        ) : (
          <Link href={`/${orgSlug}/integrations`}>
            <Button variant="outline">{t("connectCalFirst")}</Button>
          </Link>
        )}
      </div>

      {!calConnected && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
          <p className="text-sm text-amber-700 dark:text-amber-400">{t("needsCal")}</p>
        </div>
      )}

      <div className="space-y-3">
        {courses.length === 0 && calConnected && (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground text-sm">
            {t("empty")}
          </div>
        )}
        {courses.map((c) => (
          <Link key={c.id} href={`/${orgSlug}/courses/${c.id}`} className="block">
            <div className="rounded-lg border p-4 flex items-start justify-between gap-4 hover:bg-muted/40 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{c.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {c.active ? t("published") : t("draft")}
                  </span>
                </div>
                {c.description && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{c.description}</p>
                )}
                <p className="text-sm font-semibold mt-1">{formatBrl(c.price_brl, tc("free"))}</p>
              </div>
              <span className="text-sm text-muted-foreground shrink-0">{t("edit")}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
