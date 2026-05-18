import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LandingPage } from "@/components/marketing/landing-page";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";

export default async function HomePage() {
  const supabase = await getServerClientFromCookies();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <LandingPage />;
  }

  const { data: org, error } = await supabase
    .from("organizations")
    .select("slug")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <h1 className="text-xl font-semibold">Não foi possível carregar sua organização</h1>
        <p className="text-muted-foreground max-w-md text-center text-sm">
          {error.message}. Se você acabou de fazer signup, pode ser política do banco: rode a migration
          <code className="mx-1 rounded bg-muted px-1">00002_organizations_rls_owner.sql</code>
          ou peça ao admin para vincular seu usuário a uma organização.
        </p>
        <form action="/api/auth/signout" method="post">
          <Button variant="outline" type="submit">Sair</Button>
        </form>
      </div>
    );
  }

  if (org?.slug) {
    redirect(`/${org.slug}/kb`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-xl font-semibold">Sem organização vinculada</h1>
      <p className="text-muted-foreground max-w-md text-center text-sm">
        Sua conta está ativa, mas não existe uma organização com você como proprietário (<code className="text-xs">{user.email}</code>).
        Peça ao administrador para criar a organização (API admin ou painel Supabase).
      </p>
      <Link href="/login">
        <Button variant="outline">Voltar ao login</Button>
      </Link>
    </div>
  );
}
