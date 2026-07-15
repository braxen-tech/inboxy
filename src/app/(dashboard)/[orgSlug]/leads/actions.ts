"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { manageLeadLabels } from "@/application/services/lead-labels";
import { requireOrgCapability } from "@/lib/authz";

async function requireLeadWriter(orgSlug: string) {
  return requireOrgCapability(orgSlug, "write_leads");
}

async function requirePipelineAdmin(orgSlug: string) {
  return requireOrgCapability(orgSlug, "manage_pipeline");
}

const moveSchema = z.object({
  orgSlug: z.string().min(1),
  leadId: z.string().uuid(),
  targetStageId: z.string().uuid(),
  targetPosition: z.number().int().nonnegative(),
});

export async function moveLead(raw: z.infer<typeof moveSchema>) {
  const parsed = moveSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requireLeadWriter(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user, org } = ctx;

  const { data: current } = await supabase
    .from("leads")
    .select("pipeline_stage_id")
    .eq("id", parsed.data.leadId)
    .eq("organization_id", org.id)
    .maybeSingle();

  const { error: upErr } = await supabase
    .from("leads")
    .update({
      pipeline_stage_id: parsed.data.targetStageId,
      position: parsed.data.targetPosition,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.leadId)
    .eq("organization_id", org.id);

  if (upErr) return { error: upErr.message };

  if (current?.pipeline_stage_id !== parsed.data.targetStageId) {
    await supabase.from("activities").insert({
      organization_id: org.id,
      entity_type: "lead",
      entity_id: parsed.data.leadId,
      user_id: user.id,
      type: "stage_changed",
      metadata: { from: current?.pipeline_stage_id, to: parsed.data.targetStageId },
    });
  }

  revalidatePath(`/${parsed.data.orgSlug}/leads`);
  return { success: true as const };
}

const createSchema = z.object({
  orgSlug: z.string().min(1),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid(),
  title: z.string().min(1).max(200),
  contactId: z.string().uuid().optional(),
  value: z.number().nonnegative().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export async function createLead(raw: z.infer<typeof createSchema>) {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requireLeadWriter(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, user, org } = ctx;

  let contactId = parsed.data.contactId;
  if (!contactId) {
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      .insert({
        organization_id: org.id,
        name: parsed.data.title,
      })
      .select("id")
      .single();
    if (contactErr || !contact) return { error: contactErr?.message ?? "Falha ao criar contato." };
    contactId = contact.id as string;
  }

  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("pipeline_stage_id", parsed.data.stageId);

  const { data: lead, error: insErr } = await supabase
    .from("leads")
    .insert({
      organization_id: org.id,
      pipeline_id: parsed.data.pipelineId,
      pipeline_stage_id: parsed.data.stageId,
      title: parsed.data.title,
      contact_id: contactId,
      value: parsed.data.value ?? 0,
      position: (count ?? 0) * 1000,
      status: "open",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insErr || !lead) return { error: insErr?.message ?? "Falha ao criar lead." };

  if (parsed.data.tagIds?.length) {
    await supabase.from("lead_tags").upsert(
      parsed.data.tagIds.map((tag_id) => ({ lead_id: lead.id, tag_id })),
      { onConflict: "lead_id,tag_id" },
    );
  }

  revalidatePath(`/${parsed.data.orgSlug}/leads`);
  return { success: true as const, leadId: lead.id as string };
}

const updateLeadSchema = z.object({
  orgSlug: z.string().min(1),
  leadId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  value: z.number().nonnegative().optional(),
  contactId: z.string().uuid().optional().nullable(),
  status: z.enum(["open", "won", "lost"]).optional(),
  description: z.string().max(5000).optional().nullable(),
});

export async function updateLead(raw: z.infer<typeof updateLeadSchema>) {
  const parsed = updateLeadSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requireLeadWriter(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, org } = ctx;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.value !== undefined) patch.value = parsed.data.value;
  if (parsed.data.contactId !== undefined) patch.contact_id = parsed.data.contactId;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.status !== undefined) {
    patch.status = parsed.data.status;
    if (parsed.data.status === "won" || parsed.data.status === "lost") {
      patch.closed_at = new Date().toISOString();
    } else {
      patch.closed_at = null;
    }
  }

  const { error } = await supabase
    .from("leads")
    .update(patch)
    .eq("id", parsed.data.leadId)
    .eq("organization_id", org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${parsed.data.orgSlug}/leads`);
  return { success: true as const };
}

const deleteLeadSchema = z.object({
  orgSlug: z.string().min(1),
  leadId: z.string().uuid(),
});

export async function deleteLead(raw: z.infer<typeof deleteLeadSchema>) {
  const parsed = deleteLeadSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requireLeadWriter(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, org } = ctx;

  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", parsed.data.leadId)
    .eq("organization_id", org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${parsed.data.orgSlug}/leads`);
  return { success: true as const };
}

const setLeadTagsSchema = z.object({
  orgSlug: z.string().min(1),
  leadId: z.string().uuid(),
  tagIds: z.array(z.string().uuid()),
});

export async function setLeadTags(raw: z.infer<typeof setLeadTagsSchema>) {
  const parsed = setLeadTagsSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requireLeadWriter(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, org } = ctx;

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", parsed.data.leadId)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (!lead) return { error: "Lead não encontrado." };

  if (parsed.data.tagIds.length > 0) {
    const { count } = await supabase
      .from("tags")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .in("id", parsed.data.tagIds);
    if ((count ?? 0) !== parsed.data.tagIds.length) {
      return { error: "Uma ou mais tags são inválidas." };
    }
  }

  await supabase.from("lead_tags").delete().eq("lead_id", parsed.data.leadId);

  if (parsed.data.tagIds.length > 0) {
    const { error } = await supabase.from("lead_tags").insert(
      parsed.data.tagIds.map((tag_id) => ({ lead_id: parsed.data.leadId, tag_id })),
    );
    if (error) return { error: error.message };
  }

  revalidatePath(`/${parsed.data.orgSlug}/leads`);
  return { success: true as const };
}

const createStageSchema = z.object({
  orgSlug: z.string().min(1),
  pipelineId: z.string().uuid(),
  name: z.string().min(1).max(80),
  color: z.string().max(32).optional(),
});

export async function createStage(raw: z.infer<typeof createStageSchema>) {
  const parsed = createStageSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requirePipelineAdmin(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, org } = ctx;

  const { data: last } = await supabase
    .from("pipeline_stages")
    .select("position")
    .eq("pipeline_id", parsed.data.pipelineId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: stage, error } = await supabase
    .from("pipeline_stages")
    .insert({
      organization_id: org.id,
      pipeline_id: parsed.data.pipelineId,
      name: parsed.data.name,
      color: parsed.data.color ?? "#94a3b8",
      position: (last?.position ?? -1) + 1,
    })
    .select("id, name, position, color")
    .single();

  if (error || !stage) return { error: error?.message ?? "Falha ao criar coluna." };
  revalidatePath(`/${parsed.data.orgSlug}/leads`);
  return { success: true as const, stage };
}

const updateStageSchema = z.object({
  orgSlug: z.string().min(1),
  stageId: z.string().uuid(),
  name: z.string().min(1).max(80).optional(),
  color: z.string().max(32).optional().nullable(),
});

export async function updateStage(raw: z.infer<typeof updateStageSchema>) {
  const parsed = updateStageSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requirePipelineAdmin(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, org } = ctx;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.color !== undefined) patch.color = parsed.data.color;

  const { error } = await supabase
    .from("pipeline_stages")
    .update(patch)
    .eq("id", parsed.data.stageId)
    .eq("organization_id", org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${parsed.data.orgSlug}/leads`);
  return { success: true as const };
}

const reorderStagesSchema = z.object({
  orgSlug: z.string().min(1),
  pipelineId: z.string().uuid(),
  stageIds: z.array(z.string().uuid()).min(1),
});

export async function reorderStages(raw: z.infer<typeof reorderStagesSchema>) {
  const parsed = reorderStagesSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requirePipelineAdmin(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, org } = ctx;

  for (let i = 0; i < parsed.data.stageIds.length; i++) {
    const { error } = await supabase
      .from("pipeline_stages")
      .update({ position: i, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.stageIds[i])
      .eq("pipeline_id", parsed.data.pipelineId)
      .eq("organization_id", org.id);
    if (error) return { error: error.message };
  }

  revalidatePath(`/${parsed.data.orgSlug}/leads`);
  return { success: true as const };
}

const deleteStageSchema = z.object({
  orgSlug: z.string().min(1),
  stageId: z.string().uuid(),
  moveLeadsToStageId: z.string().uuid().optional(),
});

export async function deleteStage(raw: z.infer<typeof deleteStageSchema>) {
  const parsed = deleteStageSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requirePipelineAdmin(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, org } = ctx;

  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("pipeline_stage_id", parsed.data.stageId)
    .eq("organization_id", org.id);

  if ((count ?? 0) > 0) {
    if (!parsed.data.moveLeadsToStageId) {
      return {
        error: "Esta coluna tem leads. Informe uma coluna destino para movê-los antes de excluir.",
      };
    }
    if (parsed.data.moveLeadsToStageId === parsed.data.stageId) {
      return { error: "A coluna destino deve ser diferente." };
    }
    const { error: moveErr } = await supabase
      .from("leads")
      .update({
        pipeline_stage_id: parsed.data.moveLeadsToStageId,
        updated_at: new Date().toISOString(),
      })
      .eq("pipeline_stage_id", parsed.data.stageId)
      .eq("organization_id", org.id);
    if (moveErr) return { error: moveErr.message };
  }

  const { error } = await supabase
    .from("pipeline_stages")
    .delete()
    .eq("id", parsed.data.stageId)
    .eq("organization_id", org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${parsed.data.orgSlug}/leads`);
  return { success: true as const };
}

/** Kept for agent tools / future use — re-export shape used by manage_lead_tags path via UI is setLeadTags. */
export async function addRemoveLeadTagsByName(raw: {
  orgSlug: string;
  leadId: string;
  labels: string[];
  action: "add" | "remove";
}) {
  const ctx = await requireLeadWriter(raw.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, org } = ctx;

  const result = await manageLeadLabels({
    db: supabase,
    orgId: org.id,
    leadId: raw.leadId,
    labels: raw.labels,
    action: raw.action,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath(`/${raw.orgSlug}/leads`);
  return { success: true as const, labels: result.labels };
}
