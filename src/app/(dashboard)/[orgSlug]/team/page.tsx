import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { TeamManager } from "./team-manager";
import { can } from "@/lib/authz";
import type { MemberRole } from "@/domain/entities/organization-member";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function TeamPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = await getServerClientFromCookies();
  const {
    data: { user },
  } = await db.auth.getUser();

  const [{ data: members }, { data: invites }, { data: myMembership }] = await Promise.all([
    db
      .from("organization_members")
      .select("id, role, user_id, created_at")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: true }),
    db
      .from("organization_invites")
      .select("id, email, role, invited_by, created_at, expires_at, accepted_at")
      .eq("organization_id", org.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
    user
      ? db
          .from("organization_members")
          .select("role")
          .eq("organization_id", org.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const userIds = [...new Set((members ?? []).map((m) => m.user_id as string))];
  const profilesById = new Map<
    string,
    { email: string | null; name: string | null; avatar_url: string | null }
  >();

  if (userIds.length > 0) {
    const { data: profiles } = await db
      .from("user_profiles")
      .select("id, email, name, avatar_url")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profilesById.set(p.id as string, {
        email: (p.email as string | null) ?? null,
        name: (p.name as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
      });
    }
  }

  const myRole = ((myMembership as { role?: string } | null)?.role ?? null) as MemberRole | null;
  const canManage = can(myRole, "manage_team");

  const memberRows = (members ?? []).map((m) => {
    const profile = profilesById.get(m.user_id as string);
    return {
      id: m.id as string,
      userId: m.user_id as string,
      role: m.role as "admin" | "agent" | "viewer",
      email: profile?.email ?? "",
      name: profile?.name ?? profile?.email ?? "Usuário",
      createdAt: m.created_at as string,
    };
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Equipe</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie membros, permissões e convites da organização.
        </p>
      </div>

      <TeamManager
        orgSlug={orgSlug}
        canManage={canManage}
        members={memberRows}
        invites={(invites ?? []).map((i) => ({
          id: i.id as string,
          email: i.email as string,
          role: i.role as "admin" | "agent" | "viewer",
          createdAt: i.created_at as string,
          expiresAt: i.expires_at as string,
        }))}
      />
    </div>
  );
}
