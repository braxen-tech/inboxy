"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { getResendClient, getFromAddress } from "@/infrastructure/adapters/resend/client";
import { logger } from "@/lib/logger";
import { getAppUrl } from "@/lib/app-url";

type Role = "admin" | "agent" | "viewer";

async function requireAdmin(orgSlug: string) {
  const supabase = await getServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." as const };

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) return { error: "Organização não encontrada." as const };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "admin") {
    return { error: "Somente administradores podem executar esta ação." as const };
  }

  return { supabase, user, org };
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
  const { supabase, user, org } = ctx;

  const email = parsed.data.email.toLowerCase();

  const { data: existingProfile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    const { data: alreadyMember } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", org.id)
      .eq("user_id", existingProfile.id)
      .maybeSingle();
    if (alreadyMember) {
      return { error: "Este usuário já é membro desta organização." };
    }
  }

  const { data: existingInvite } = await supabase
    .from("organization_invites")
    .select("id, accepted_at")
    .eq("organization_id", org.id)
    .eq("email", email)
    .maybeSingle();

  if (existingInvite && !existingInvite.accepted_at) {
    return {
      error: "Já existe um convite pendente para este e-mail. Revogue-o na lista abaixo para enviar de novo.",
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
    // Accepted row still blocks UNIQUE(org, email); refresh it into a new pending invite.
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    invite: {
      id: invite.id as string,
      email: invite.email as string,
      role: invite.role as Role,
      createdAt: invite.created_at as string,
      expiresAt: invite.expires_at as string,
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
