import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { LandingPage } from "@/components/marketing/landing-page";
import { getServerClientFromCookies, getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { ensureUserOrganization } from "@/lib/ensure-user-organization";
import { getOrgBySlug } from "@/lib/get-org";
import { needsBillingSetup } from "@/lib/billing-setup";

export default async function HomePage() {
  const supabase = await getServerClientFromCookies();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <LandingPage />;
  }

  // End users (portal customers) never get an org-owner dashboard or an
  // auto-provisioned organization — send them to their own portal instead.
  // RLS only lets an org's owner read `organizations`, so an end_user's own
  // client can't join to it — use the admin client for this narrow lookup.
  const { data: profile } = await getAdminClient()
    .from("users")
    .select("role, organizations:organization_id (slug)")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "end_user") {
    const org = Array.isArray(profile.organizations) ? profile.organizations[0] : profile.organizations;
    if (org?.slug) {
      redirect(`/portal/${org.slug}/library`);
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-xl font-semibold">Não foi possível encontrar sua loja</h1>
        <p className="text-muted-foreground max-w-md text-center text-sm">
          Sua conta está ativa (<code className="text-xs">{user.email}</code>), mas não conseguimos
          identificar a loja associada a ela. Entre em contato com o suporte.
        </p>
        <SignOutButton variant="outline" />
      </div>
    );
  }

  const org = await ensureUserOrganization(user);

  if (org?.slug) {
    const fullOrg = await getOrgBySlug(org.slug);
    if (fullOrg && needsBillingSetup(fullOrg)) {
      redirect(`/${org.slug}/billing?setup=required`);
    }
    redirect(`/${org.slug}/kb`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-xl font-semibold">Não foi possível preparar sua conta</h1>
      <p className="text-muted-foreground max-w-md text-center text-sm">
        Sua conta está ativa (<code className="text-xs">{user.email}</code>), mas não conseguimos criar sua organização.
        Tente entrar novamente em alguns instantes ou entre em contato com o suporte.
      </p>
      <SignOutButton variant="outline" />
    </div>
  );
}
