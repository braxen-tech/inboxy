import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

function formatBrl(value: number | null): string {
  if (value == null) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function PortalCoursesPage({ params }: Props) {
  const { orgSlug } = await params;

  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/portal/${orgSlug}/login`);
  }

  const db = getAdminClient();

  const { data: enrollments } = await db
    .from("course_enrollments")
    .select(`
      id,
      enrolled_at,
      courses (
        id,
        title,
        description,
        thumbnail_url,
        price_brl,
        organization_id,
        organizations:organization_id (slug)
      )
    `)
    .eq("end_user_id", user.id)
    .eq("status", "active")
    .order("enrolled_at", { ascending: false });

  const active = (enrollments ?? []).filter((e) => e.courses);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Meus Cursos</h1>
            <p className="text-sm text-muted-foreground mt-1">Cursos que você está matriculado</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/portal/${orgSlug}/library`} className="text-sm text-muted-foreground hover:text-foreground">
              Produtos digitais
            </Link>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">Sair</button>
            </form>
          </div>
        </div>

        {active.length === 0 && (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            <p className="text-sm">Você ainda não está matriculado em nenhum curso.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {active.map((enrollment) => {
            const course = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses;
            if (!course) return null;
            return (
              <Link key={enrollment.id} href={`/portal/${orgSlug}/courses/${course.id}`} className="group rounded-lg border overflow-hidden hover:shadow-md transition-shadow">
                {course.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={course.thumbnail_url} alt={course.title} className="w-full aspect-video object-cover" />
                ) : (
                  <div className="w-full aspect-video bg-muted flex items-center justify-center text-muted-foreground text-sm">
                    {course.title.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="p-4">
                  <p className="font-semibold group-hover:underline">{course.title}</p>
                  {course.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{course.description}</p>
                  )}
                  <p className="text-xs text-primary mt-2 font-medium">Continuar →</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
