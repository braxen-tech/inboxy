"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { getResendClient, getFromAddress } from "@/infrastructure/adapters/resend/client";
import { logger } from "@/lib/logger";
import { getAppUrl } from "@/lib/app-url";
import { requireOrgCapability } from "@/lib/authz";
import type { MemberRole } from "@/domain/entities/organization-member";

type Role = MemberRole;

async function requireAdmin(orgSlug: string) {
  return requireOrgCapability(orgSlug, "manage_team");
}

const inviteSchema = z.object({
  orgSlug: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "agent", "viewer"]),
});

export async function inviteMember(raw: z.infer<typeof inviteSchema>) {
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requireAdmin(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { user, org } = ctx;
  const admin = getAdminClient();

  const email = parsed.data.email.toLowerCase();

  const { data: existingProfile } = await admin
    .from("user_profiles")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();

  if (existingProfile) {
    const { data: alreadyMember } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", org.id)
      .eq("user_id", existingProfile.id)
      .maybeSingle();
    if (alreadyMember) {
      return { error: "Este usuário já é membro desta organização." };
    }

    // Account already exists — add to org immediately (no pending accept step).
    const { error: memberErr } = await admin.from("organization_members").upsert(
      {
        organization_id: org.id,
        user_id: existingProfile.id,
        role: parsed.data.role,
        invited_by: user.id,
      },
      { onConflict: "organization_id,user_id" },
    );
    if (memberErr) return { error: memberErr.message };

    await admin.from("organization_invites").upsert(
      {
        organization_id: org.id,
        email,
        role: parsed.data.role,
        invited_by: user.id,
        token: randomBytes(24).toString("hex"),
        expires_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,email" },
    );

    revalidatePath(`/${parsed.data.orgSlug}/team`);
    return {
      success: true as const,
      emailed: false,
      addedDirectly: true as const,
      member: {
        userId: existingProfile.id as string,
        email,
        role: parsed.data.role,
      },
      invite: null,
      acceptUrl: null,
    };
  }

  const { data: existingInvite } = await admin
    .from("organization_invites")
    .select("id, accepted_at")
    .eq("organization_id", org.id)
    .eq("email", email)
    .maybeSingle();

  if (existingInvite && !existingInvite.accepted_at) {
    return {
      error:
        "Já existe um convite pendente para este e-mail. Revogue-o na lista abaixo para enviar de novo.",
    };
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  type InviteRow = {
    id: string;
    email: string;
    role: string;
    created_at: string;
    expires_at: string;
  };

  let invite: InviteRow | null = null;

  if (existingInvite?.accepted_at) {
    const { data, error } = await admin
      .from("organization_invites")
      .update({
        role: parsed.data.role,
        invited_by: user.id,
        token,
        expires_at: expiresAt,
        accepted_at: null,
      })
      .eq("id", existingInvite.id)
      .select("id, email, role, created_at, expires_at")
      .single();
    if (error || !data) return { error: error?.message ?? "Falha ao recriar convite." };
    invite = data as InviteRow;
  } else {
    const { data, error } = await admin
      .from("organization_invites")
      .insert({
        organization_id: org.id,
        email,
        role: parsed.data.role,
        invited_by: user.id,
        token,
        expires_at: expiresAt,
      })
      .select("id, email, role, created_at, expires_at")
      .single();
    if (error || !data) return { error: error?.message ?? "Falha ao criar convite." };
    invite = data as InviteRow;
  }

  if (!invite) return { error: "Falha ao criar convite." };

  const appUrl = getAppUrl().replace(/\/$/, "");
  const acceptUrl = `${appUrl}/invite/${token}`;

  const resend = getResendClient();
  let emailed = false;
  if (resend) {
    try {
      await resend.emails.send({
        from: getFromAddress(),
        to: invite.email,
        subject: `Convite para ${org.name} no Inboxy`,
        html: `
          <p>Você foi convidado para se juntar à organização <strong>${org.name}</strong> no Inboxy.</p>
          <p>
            <a href="${acceptUrl}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">
              Aceitar convite
            </a>
          </p>
          <p style="color:#666;font-size:12px;">Este convite expira em 7 dias.</p>
        `,
      });
      emailed = true;
    } catch (err) {
      logger.warn("Invite email failed", { error: String(err) });
    }
  } else {
    logger.warn("RESEND_API_KEY ausente — convite criado sem e-mail", { orgId: org.id });
  }

  revalidatePath(`/${parsed.data.orgSlug}/team`);
  return {
    success: true as const,
    emailed,
    addedDirectly: false as const,
    member: null,
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role as Role,
      createdAt: invite.created_at,
      expiresAt: invite.expires_at,
    },
    acceptUrl,
  };
}

const roleSchema = z.object({
  orgSlug: z.string().min(1),
  memberId: z.string().uuid(),
  role: z.enum(["admin", "agent", "viewer"]),
});

export async function updateMemberRole(raw: z.infer<typeof roleSchema>) {
  const parsed = roleSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requireAdmin(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, org } = ctx;

  const { error } = await supabase
    .from("organization_members")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.memberId)
    .eq("organization_id", org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${parsed.data.orgSlug}/team`);
  return { success: true as const };
}

const removeSchema = z.object({ orgSlug: z.string().min(1), memberId: z.string().uuid() });

export async function removeMember(raw: z.infer<typeof removeSchema>) {
  const parsed = removeSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requireAdmin(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, org } = ctx;

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", parsed.data.memberId)
    .eq("organization_id", org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${parsed.data.orgSlug}/team`);
  return { success: true as const };
}

const revokeSchema = z.object({ orgSlug: z.string().min(1), inviteId: z.string().uuid() });

export async function revokeInvite(raw: z.infer<typeof revokeSchema>) {
  const parsed = revokeSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const ctx = await requireAdmin(parsed.data.orgSlug);
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, org } = ctx;

  const { error } = await supabase
    .from("organization_invites")
    .delete()
    .eq("id", parsed.data.inviteId)
    .eq("organization_id", org.id);

  if (error) return { error: error.message };
  revalidatePath(`/${parsed.data.orgSlug}/team`);
  return { success: true as const };
}
