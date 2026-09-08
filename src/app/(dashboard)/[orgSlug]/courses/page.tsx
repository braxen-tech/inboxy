import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

function formatBrl(value: number | null): string {
  if (value == null) return "Grátis";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function CoursesPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = getAdminClient();
  const { data: courses } = await db
    .from("courses")
    .select("id, title, description, price_brl, active, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cursos Online</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie cursos em vídeo que seus alunos podem comprar e assistir
          </p>
        </div>
        <Link href={`/${orgSlug}/courses/new`}>
          <Button>Novo curso</Button>
        </Link>
      </div>

      <div className="space-y-3">
        {!courses?.length && (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground text-sm">
            Nenhum curso ainda. Crie seu primeiro curso.
          </div>
        )}
        {courses?.map((c) => (
          <Link key={c.id} href={`/${orgSlug}/courses/${c.id}`} className="block">
            <div className="rounded-lg border p-4 flex items-start justify-between gap-4 hover:bg-muted/40 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{c.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {c.active ? "Publicado" : "Rascunho"}
                  </span>
                </div>
                {c.description && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{c.description}</p>
                )}
                <p className="text-sm font-semibold mt-1">{formatBrl(c.price_brl)}</p>
              </div>
              <span className="text-sm text-muted-foreground shrink-0">Editar →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
