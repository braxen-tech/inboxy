import { notFound, redirect } from "next/navigation";
import {
  getAdminClient,
  getServerClientFromCookies,
} from "@/infrastructure/repositories/supabase-clients";
import { acceptInvite } from "./actions";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function AcceptInvitePage({ params }: Props) {
  const { token } = await params;
  const supabase = await getServerClientFromCookies();
  const admin = getAdminClient();

  const { data: invite } = await admin
    .from("organization_invites")
    .select("id, organization_id, email, role, expires_at, accepted_at, organizations(slug, name)")
    .eq("token", token)
    .maybeSingle();

  if (!invite) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/invite/${token}`);
  }

  const org = (Array.isArray(invite.organizations) ? invite.organizations[0] : invite.organizations) as {
    slug: string;
    name: string;
  } | null;

  const expired = new Date(invite.expires_at as string).getTime() < Date.now();
  const alreadyAccepted = !!invite.accepted_at;

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
      <div className="w-full space-y-4 rounded-lg border p-6">
        <h1 className="text-xl font-semibold">Convite para {org?.name ?? "organização"}</h1>
        <p className="text-sm text-muted-foreground">
          Você foi convidado como <strong>{invite.role as string}</strong> para{" "}
          <strong>{invite.email as string}</strong>.
        </p>

        {expired && <p className="text-sm text-destructive">Este convite expirou.</p>}
        {alreadyAccepted && (
          <p className="text-sm text-muted-foreground">Este convite já foi aceito.</p>
        )}

        {!expired && !alreadyAccepted && (
          <form action={acceptInvite}>
            <input type="hidden" name="token" value={token} />
            <Button type="submit" className="w-full">
              Aceitar convite
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
