import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { ProductForm } from "./product-form";
import { DeleteProductButton } from "./delete-product-button";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatBrl(value: number | null): string {
  if (value == null) return "Grátis";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function ProductsPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = getAdminClient();
  const { data: products } = await db
    .from("digital_products")
    .select("id, title, description, file_name, file_size_bytes, price_brl, payment_type, active, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Produtos Digitais</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie arquivos digitais que seus clientes podem comprar e baixar
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Product list */}
        <div className="lg:col-span-2 space-y-3">
          {!products?.length && (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
              Nenhum produto digital ainda. Crie seu primeiro produto ao lado.
            </div>
          )}
          {products?.map((p) => (
            <div key={p.id} className="rounded-lg border p-4 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{p.title}</span>
                  {!p.active && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Inativo</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{p.file_name} {p.file_size_bytes ? `· ${formatBytes(p.file_size_bytes)}` : ""}</p>
                <p className="text-sm font-semibold mt-1">{formatBrl(p.price_brl)} <span className="font-normal text-muted-foreground text-xs">· {p.payment_type === "one_time" ? "único" : "recorrente"}</span></p>
              </div>
              <DeleteProductButton orgSlug={orgSlug} productId={p.id} />
            </div>
          ))}
        </div>

        {/* Create form */}
        <div className="rounded-lg border p-5 space-y-4 h-fit">
          <h2 className="font-semibold text-sm">Novo produto</h2>
          <ProductForm orgSlug={orgSlug} />
        </div>
      </div>
    </div>
  );
}
