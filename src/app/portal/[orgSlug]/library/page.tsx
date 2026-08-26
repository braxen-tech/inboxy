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

  const { data: purchases } = await db
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
        price_brl,
        organization_id,
        organizations:organization_id (
          slug
        )
      )
    `)
    .eq("end_user_id", user.id)
    .eq("status", "active")
    .order("purchased_at", { ascending: false });

  const activePurchases = purchases?.filter(
    (p) => p.digital_products && (p.digital_products as { organizations?: { slug?: string }[] }).organizations
  ) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Minha Biblioteca</h1>
            <p className="text-sm text-muted-foreground mt-1">Seus produtos digitais adquiridos</p>
          </div>
          <form action="/api/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm">Sair</Button>
          </form>
        </div>

        {activePurchases.length === 0 && (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            <p className="text-sm">Você ainda não tem produtos na biblioteca.</p>
          </div>
        )}

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
      </div>
    </div>
  );
}
