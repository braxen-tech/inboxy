import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { MemberRole } from "@/domain/entities/organization-member";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import {
  hasCapability,
  OWNER_OR_ADMIN_CAPS,
  type OrgCapability,
} from "@/lib/authz";

export type OrgAuthzOk = {
  supabase: SupabaseClient;
  user: User;
  org: { id: string; name?: string | null; slug?: string | null; owner_user_id?: string | null };
  role: MemberRole | null;
  isOwner: boolean;
};

export type OrgAuthzResult = OrgAuthzOk | { error: string };

export async function requireOrgCapability(
  orgSlug: string,
  capability: OrgCapability,
): Promise<OrgAuthzResult> {
  const supabase = await getServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, owner_user_id")
    .eq("slug", orgSlug)
    .maybeSingle();

  if (!org) return { error: "Organização não encontrada." };

  const isOwner = org.owner_user_id === user.id;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const role = (membership?.role as MemberRole | undefined) ?? null;

  if (!membership && !isOwner) {
    return { error: "Sem permissão nesta organização." };
  }

  // Owner without membership row: treat as admin for capability checks
  const effectiveRole: MemberRole | null = role ?? (isOwner ? "admin" : null);

  const allowedByRole = hasCapability(effectiveRole, capability);
  const allowedByOwner = OWNER_OR_ADMIN_CAPS.has(capability) && isOwner;

  if (!allowedByRole && !allowedByOwner) {
    return { error: "Você não tem permissão para esta ação." };
  }

  return {
    supabase,
    user,
    org: {
      id: org.id as string,
      name: org.name as string | null,
      slug: org.slug as string | null,
      owner_user_id: org.owner_user_id as string | null,
    },
    role: effectiveRole,
    isOwner,
  };
}

/** Convenience: admin-only team management. */
export async function requireAdmin(orgSlug: string): Promise<OrgAuthzResult> {
  return requireOrgCapability(orgSlug, "manage_team");
}

/** Resolve membership role for UI (no capability gate). */
export async function getOrgMembershipRole(
  orgSlug: string,
): Promise<{ role: MemberRole | null; orgId: string | null; error?: string }> {
  const supabase = await getServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { role: null, orgId: null, error: "Não autenticado." };

  const { data: org } = await supabase
    .from("organizations")
    .select("id, owner_user_id")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) return { role: null, orgId: null, error: "Organização não encontrada." };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role) {
    return { role: membership.role as MemberRole, orgId: org.id as string };
  }
  if (org.owner_user_id === user.id) {
    return { role: "admin", orgId: org.id as string };
  }
  return { role: null, orgId: org.id as string };
}
