import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { BroadcastForm } from "./broadcast-form";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function NewBroadcastPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = getAdminClient();
  const { count } = await db
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("role", "end_user")
    .not("email", "is", null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Novo email</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {count
            ? `Será enviado para ${count} destinatário${count === 1 ? "" : "s"} da sua base`
            : "Nenhum destinatário encontrado na sua base"}
        </p>
      </div>

      <BroadcastForm orgSlug={orgSlug} recipientCount={count ?? 0} />
    </div>
  );
}
