import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LandingPage } from "@/components/marketing/landing-page";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { ensureUserOrganization } from "@/lib/ensure-user-organization";

export default async function HomePage() {
  const supabase = await getServerClientFromCookies();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <LandingPage />;
  }

  const org = await ensureUserOrganization(user);

  if (org?.slug) {
    redirect(`/${org.slug}/kb`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-xl font-semibold">Não foi possível preparar sua conta</h1>
      <p className="text-muted-foreground max-w-md text-center text-sm">
        Sua conta está ativa (<code className="text-xs">{user.email}</code>), mas não conseguimos criar sua organização.
        Tente entrar novamente em alguns instantes ou entre em contato com o suporte.
      </p>
      <form action="/api/auth/signout" method="post">
        <Button variant="outline" type="submit">Sair</Button>
      </form>
    </div>
  );
}
