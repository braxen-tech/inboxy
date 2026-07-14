"use server";

import { redirect } from "next/navigation";
import {
  getAdminClient,
  getServerClientFromCookies,
} from "@/infrastructure/repositories/supabase-clients";

export type AcceptInviteState = { error: string } | null;

export async function acceptInvite(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const token = formData.get("token");
  if (typeof token !== "string" || !token) {
    return { error: "Token inválido." };
  }

  const supabase = await getServerClientFromCookies();
  const admin = getAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/invite/${token}`);

  const { data: invite, error: findErr } = await admin
    .from("organization_invites")
    .select("id, organization_id, email, role, expires_at, accepted_at, organizations(slug)")
    .eq("token", token)
    .maybeSingle();

  if (findErr || !invite) return { error: "Convite não encontrado." };
  if (invite.accepted_at) return { error: "Este convite já foi aceito." };
  if (new Date(invite.expires_at as string).getTime() < Date.now()) {
    return { error: "Este convite expirou." };
  }

  const email = user.email?.toLowerCase();
  const inviteEmail = (invite.email as string).toLowerCase();
  if (!email) {
    return { error: "Sua conta não tem e-mail. Faça login com outra conta." };
  }
  if (email !== inviteEmail) {
    return {
      error: `Este convite foi enviado para ${invite.email}. Você está logado como ${user.email}. Saia e entre com o e-mail do convite.`,
    };
  }

  const { error: memberErr } = await admin.from("organization_members").upsert(
    {
      organization_id: invite.organization_id as string,
      user_id: user.id,
      role: invite.role as "admin" | "agent" | "viewer",
    },
    { onConflict: "organization_id,user_id" },
  );

  if (memberErr) {
    return { error: memberErr.message || "Falha ao adicionar você à organização." };
  }

  const { error: acceptErr } = await admin
    .from("organization_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id as string);

  if (acceptErr) {
    return { error: acceptErr.message || "Falha ao marcar o convite como aceito." };
  }

  const org = (Array.isArray(invite.organizations) ? invite.organizations[0] : invite.organizations) as {
    slug: string;
  } | null;

  if (!org?.slug) {
    return { error: "Organização do convite inválida." };
  }

  redirect(`/${org.slug}`);
}
