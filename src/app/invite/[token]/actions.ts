"use server";

import { redirect } from "next/navigation";
import {
  getAdminClient,
  getServerClientFromCookies,
} from "@/infrastructure/repositories/supabase-clients";

export async function acceptInvite(formData: FormData) {
  const token = formData.get("token");
  if (typeof token !== "string" || !token) throw new Error("Token inválido.");

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

  if (findErr || !invite) throw new Error("Convite não encontrado.");
  if (invite.accepted_at) throw new Error("Convite já aceito.");
  if (new Date(invite.expires_at as string).getTime() < Date.now()) {
    throw new Error("Convite expirado.");
  }

  const email = user.email?.toLowerCase();
  if (email && email !== (invite.email as string).toLowerCase()) {
    throw new Error(`Este convite foi enviado para ${invite.email}. Faça login com esse email.`);
  }

  await admin
    .from("organization_members")
    .upsert(
      {
        organization_id: invite.organization_id as string,
        user_id: user.id,
        role: invite.role as "admin" | "agent" | "viewer",
      },
      { onConflict: "organization_id,user_id" },
    );

  await admin
    .from("organization_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id as string);

  const org = (Array.isArray(invite.organizations) ? invite.organizations[0] : invite.organizations) as {
    slug: string;
  } | null;

  redirect(`/${org?.slug ?? ""}`);
}
