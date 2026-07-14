"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";

async function resolveOrg(orgSlug: string) {
  const supabase = await getServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." as const, supabase };

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) return { error: "Organização não encontrada." as const, supabase };

  return { supabase, user, org };
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

  const { supabase, user, org, error } = await resolveOrg(parsed.data.orgSlug);
  if (error || !org || !user) return { error: error ?? "Não autenticado." };

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
});

export async function createLead(raw: z.infer<typeof createSchema>) {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const { supabase, user, org, error } = await resolveOrg(parsed.data.orgSlug);
  if (error || !org || !user) return { error: error ?? "Não autenticado." };

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

  const { error: insErr } = await supabase.from("leads").insert({
    organization_id: org.id,
    pipeline_id: parsed.data.pipelineId,
    pipeline_stage_id: parsed.data.stageId,
    title: parsed.data.title,
    contact_id: contactId,
    value: parsed.data.value ?? 0,
    position: (count ?? 0) * 1000,
    status: "open",
    created_by: user.id,
  });

  if (insErr) return { error: insErr.message };
  revalidatePath(`/${parsed.data.orgSlug}/leads`);
  return { success: true as const };
}
