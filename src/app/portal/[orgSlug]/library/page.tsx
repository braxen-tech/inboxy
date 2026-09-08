import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function PortalLibraryPage({ params }: Props) {
  const { orgSlug } = await params;

  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/portal/${orgSlug}/login`);
  }

  const db = getAdminClient();

  const [{ data: purchases }, { data: enrollments }] = await Promise.all([
    db
      .from("digital_product_purchases")
      .select(`
        id,
        status,
        purchased_at,
        download_count,
        digital_products (
          id,
          title,
          description,
          file_name,
          price_brl
        )
      `)
      .eq("end_user_id", user.id)
      .eq("status", "active")
      .order("purchased_at", { ascending: false }),

    db
      .from("course_enrollments")
      .select(`
        id,
        status,
        enrolled_at,
        courses (
          id,
          title,
          description,
          thumbnail_url
        )
      `)
      .eq("end_user_id", user.id)
      .eq("status", "active")
      .order("enrolled_at", { ascending: false }),
  ]);

  const activePurchases = (purchases ?? []).filter((p) => p.digital_products);
  const activeCourses = (enrollments ?? []).filter((e) => e.courses);

  const hasNothing = activePurchases.length === 0 && activeCourses.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Minha Área</h1>
            <p className="text-sm text-muted-foreground mt-1">Seus produtos e cursos adquiridos</p>
          </div>
          <form action="/api/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm">Sair</Button>
          </form>
        </div>

        {hasNothing && (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            <p className="text-sm">Você ainda não tem produtos ou cursos na sua área.</p>
          </div>
        )}

        {/* Cursos */}
        {activeCourses.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-base font-semibold">Meus Cursos</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {activeCourses.map((enrollment) => {
                const course = (Array.isArray(enrollment.courses)
                  ? enrollment.courses[0]
                  : enrollment.courses) as {
                  id: string;
                  title: string;
                  description: string | null;
                  thumbnail_url: string | null;
                } | null;
                if (!course) return null;

                return (
                  <Link
                    key={enrollment.id}
                    href={`/portal/${orgSlug}/courses/${course.id}`}
                    className="group rounded-lg border overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {course.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="w-full aspect-video object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-video bg-muted flex items-center justify-center">
                        <span className="text-3xl">🎓</span>
                      </div>
                    )}
                    <div className="p-4 space-y-1">
                      <p className="font-semibold group-hover:underline line-clamp-1">{course.title}</p>
                      {course.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                      )}
                      <p className="text-xs text-primary font-medium pt-1">Acessar curso →</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Produtos Digitais */}
        {activePurchases.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-base font-semibold">Produtos Digitais</h2>
            <div className="space-y-3">
              {activePurchases.map((purchase) => {
                const product = (Array.isArray(purchase.digital_products)
                  ? purchase.digital_products[0]
                  : purchase.digital_products) as {
                  id: string;
                  title: string;
                  description: string | null;
                  file_name: string;
                  price_brl: number | null;
                } | null;
                if (!product) return null;

                return (
                  <div key={purchase.id} className="rounded-lg border p-5 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{product.title}</p>
                      {product.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{product.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {product.file_name}
                        {purchase.download_count > 0 && ` · ${purchase.download_count} download(s)`}
                      </p>
                    </div>
                    <Link href={`/api/download/${purchase.id}`}>
                      <Button size="sm">Baixar</Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
