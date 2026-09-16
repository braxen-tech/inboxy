import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getOrgBySlug } from "@/lib/get-org";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { ProductForm } from "./product-form";
import { DeleteProductButton } from "./delete-product-button";
import { PaymentTypeToggle } from "./payment-type-toggle";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatBrl(value: number | null, freeLabel: string): string {
  if (value == null) return freeLabel;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function ProductsPage({ params }: Props) {
  const { orgSlug } = await params;
  const [org, t, tc] = await Promise.all([
    getOrgBySlug(orgSlug),
    getTranslations("products"),
    getTranslations("common"),
  ]);
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
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-3">
          {!products?.length && (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
              {t("empty")}
            </div>
          )}
          {products?.map((p) => (
            <div key={p.id} className="rounded-lg border p-4 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{p.title}</span>
                  {!p.active && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{t("inactive")}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{p.file_name} {p.file_size_bytes ? `· ${formatBytes(p.file_size_bytes)}` : ""}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-semibold">{formatBrl(p.price_brl, tc("free"))}</span>
                  <PaymentTypeToggle orgSlug={orgSlug} productId={p.id} paymentType={p.payment_type as "one_time" | "recurring"} />
                </div>
              </div>
              <DeleteProductButton orgSlug={orgSlug} productId={p.id} />
            </div>
          ))}
        </div>

        <div className="rounded-lg border p-5 space-y-4 h-fit">
          <h2 className="font-semibold text-sm">{t("new")}</h2>
          <ProductForm orgSlug={orgSlug} />
        </div>
      </div>
    </div>
  );
}
