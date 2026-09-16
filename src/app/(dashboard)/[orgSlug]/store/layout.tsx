import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, ShoppingBag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getOrgBySlug } from "@/lib/get-org";
import { StoreToggleButton } from "./store-toggle-button";

interface Props {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}

export default async function StoreLayout({ params, children }: Props) {
  const { orgSlug } = await params;
  const [org, t, td] = await Promise.all([
    getOrgBySlug(orgSlug),
    getTranslations("store"),
    getTranslations("dashboard"),
  ]);
  if (!org) notFound();

  const isAllowedPlan =
    org.subscription_plan === "professional" || org.subscription_plan === "business";

  if (!isAllowedPlan) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Card className="p-8 text-center">
          <ShoppingBag className="mx-auto size-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">{td("upgradeRequired")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{td("upgradeDescription")}</p>
          <Link href={`/${orgSlug}/billing`}>
            <Button className="mt-4">{td("upgrade")}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-3">
          {org.store_enabled && (
            <Link
              href={`/s/${orgSlug}`}
              target="_blank"
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              {t("viewStore")} <ExternalLink className="size-3" />
            </Link>
          )}
          <StoreToggleButton orgSlug={orgSlug} initialEnabled={org.store_enabled ?? false} />
        </div>
      </div>
      {children}
    </div>
  );
}
