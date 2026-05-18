import { getOrgBySlug } from "@/lib/get-org";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function SettingsPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Organização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">Nome</p>
            <p className="text-sm text-muted-foreground">{org.name}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium">Slug</p>
            <p className="text-sm text-muted-foreground">{org.slug}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium">Idioma</p>
            <p className="text-sm text-muted-foreground">{org.language}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium">WhatsApp</p>
            <p className="text-sm text-muted-foreground">
              {org.whatsapp_status === "active"
                ? `Ativo — ${org.whatsapp_phone_number}`
                : "Não conectado"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
