import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { KanbanBoard } from "./kanban-board";
import { ensureDefaultPipeline } from "./ensure-pipeline";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function LeadsPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = await getServerClientFromCookies();

  const pipelineId = await ensureDefaultPipeline(db, org.id);

  const [{ data: stages }, { data: leads }] = await Promise.all([
    db
      .from("pipeline_stages")
      .select("id, name, position, color")
      .eq("pipeline_id", pipelineId)
      .order("position", { ascending: true }),
    db
      .from("leads")
      .select("id, title, value, stage_id, position, status, contact:contacts(id, name, phone, ig_username)")
      .eq("organization_id", org.id)
      .eq("pipeline_id", pipelineId)
      .neq("status", "won")
      .neq("status", "lost")
      .order("position", { ascending: true }),
  ]);

  const stageRows = (stages ?? []) as Array<{ id: string; name: string; position: number; color: string | null }>;
  const leadRows = (leads ?? []).map((l) => {
    const contact = (Array.isArray(l.contact) ? l.contact[0] : l.contact) as {
      id: string;
      name: string | null;
      phone: string | null;
      ig_username: string | null;
    } | null;
    return {
      id: l.id as string,
      title: (l.title ?? "Sem título") as string,
      value: (l.value ?? null) as number | null,
      stageId: l.stage_id as string,
      position: (l.position ?? 0) as number,
      contactName: contact?.name ?? contact?.phone ?? contact?.ig_username ?? "Sem contato",
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">Arraste os cards entre estágios para atualizar.</p>
      </div>
      <KanbanBoard orgSlug={orgSlug} pipelineId={pipelineId} stages={stageRows} leads={leadRows} />
    </div>
  );
}
