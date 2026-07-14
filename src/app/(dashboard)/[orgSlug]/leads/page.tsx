import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { KanbanBoard } from "./kanban-board";
import { ensureDefaultPipeline } from "./ensure-pipeline";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

type Role = "admin" | "agent" | "viewer";

export default async function LeadsPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = await getServerClientFromCookies();
  const {
    data: { user },
  } = await db.auth.getUser();

  let viewerRole: Role = "viewer";
  if (user) {
    const { data: membership } = await db
      .from("organization_members")
      .select("role")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membership?.role) viewerRole = membership.role as Role;
  }

  const pipelineId = await ensureDefaultPipeline(db, org.id);

  const [{ data: stages }, { data: leads }, { data: tags }] = await Promise.all([
    db
      .from("pipeline_stages")
      .select("id, name, position, color")
      .eq("pipeline_id", pipelineId)
      .order("position", { ascending: true }),
    db
      .from("leads")
      .select(
        "id, title, value, description, status, pipeline_stage_id, position, contact_id, contact:contacts(id, name, phone, ig_username), lead_tags(tag_id, tags(id, name, color))",
      )
      .eq("organization_id", org.id)
      .eq("pipeline_id", pipelineId)
      .neq("status", "won")
      .neq("status", "lost")
      .order("position", { ascending: true }),
    db
      .from("tags")
      .select("id, name, color")
      .eq("organization_id", org.id)
      .order("name", { ascending: true }),
  ]);

  const stageRows = (stages ?? []) as Array<{
    id: string;
    name: string;
    position: number;
    color: string | null;
  }>;

  const leadRows = (leads ?? []).map((l) => {
    const contact = (Array.isArray(l.contact) ? l.contact[0] : l.contact) as {
      id: string;
      name: string | null;
      phone: string | null;
      ig_username: string | null;
    } | null;

    const tagLinks = (l.lead_tags ?? []) as Array<{
      tag_id: string;
      tags: { id: string; name: string; color: string } | { id: string; name: string; color: string }[] | null;
    }>;

    const leadTags = tagLinks
      .map((lt) => {
        const t = Array.isArray(lt.tags) ? lt.tags[0] : lt.tags;
        if (!t) return null;
        return { id: t.id, name: t.name, color: t.color };
      })
      .filter((t): t is { id: string; name: string; color: string } => Boolean(t));

    return {
      id: l.id as string,
      title: (l.title ?? "Sem título") as string,
      value: (l.value ?? null) as number | null,
      description: (l.description ?? null) as string | null,
      status: (l.status ?? "open") as "open" | "won" | "lost",
      stageId: l.pipeline_stage_id as string,
      position: (l.position ?? 0) as number,
      contactId: (l.contact_id as string | null) ?? null,
      contactName: contact?.name ?? contact?.phone ?? contact?.ig_username ?? "Sem contato",
      tags: leadTags,
    };
  });

  const orgTags = (tags ?? []).map((t) => ({
    id: t.id as string,
    name: t.name as string,
    color: (t.color as string) || "#6366f1",
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">
          Arraste os cards entre estágios para atualizar. Tags e colunas em Configurações / menu da
          coluna.
        </p>
      </div>
      <KanbanBoard
        orgSlug={orgSlug}
        pipelineId={pipelineId}
        stages={stageRows}
        leads={leadRows}
        orgTags={orgTags}
        viewerRole={viewerRole}
      />
    </div>
  );
}
