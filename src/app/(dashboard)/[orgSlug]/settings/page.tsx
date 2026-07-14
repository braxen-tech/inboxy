import { getOrgBySlug } from "@/lib/get-org";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { TagsManager } from "./tags-manager";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function SettingsPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = await getServerClientFromCookies();
  const {
    data: { user },
  } = await db.auth.getUser();

  let canManageTags = false;
  if (user) {
    const { data: membership } = await db
      .from("organization_members")
      .select("role")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .maybeSingle();
    canManageTags = membership?.role === "admin";
  }

  const { data: tags } = await db
    .from("tags")
    .select("id, name, color")
    .eq("organization_id", org.id)
    .order("name", { ascending: true });

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
            <p className="text-sm font-medium">Canais de mensagem</p>
            <p className="text-sm text-muted-foreground">
              Conecte WhatsApp, Instagram DM e Telegram na página Canais.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Vocabulary compartilhado para classificar conversas e leads no Kanban. O agente só aplica
            tags já cadastradas.
          </p>
          <TagsManager
            orgSlug={orgSlug}
            canManage={canManageTags}
            initialTags={(tags ?? []).map((t) => ({
              id: t.id as string,
              name: t.name as string,
              color: (t.color as string) || "#6366f1",
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
