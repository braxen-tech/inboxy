import { getOrgBySlug } from "@/lib/get-org";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function SettingsPage({ params }: Props) {
  const { orgSlug } = await params;
  const [org, t] = await Promise.all([
    getOrgBySlug(orgSlug),
    getTranslations("settings"),
  ]);
  if (!org) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("organization")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">{t("orgName")}</p>
            <p className="text-sm text-muted-foreground">{org.name}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium">{t("orgSlug")}</p>
            <p className="text-sm text-muted-foreground">{org.slug}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium">{t("language")}</p>
            <p className="text-sm text-muted-foreground">{org.language}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium">{t("chatwoot")}</p>
            <p className="text-sm text-muted-foreground">
              {org.chatwoot_status === "active"
                ? t("chatwootActive", { accountId: org.chatwoot_account_id ?? "" })
                : t("notConnected")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
