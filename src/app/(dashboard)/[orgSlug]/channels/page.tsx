import { getOrgBySlug } from "@/lib/get-org";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { notFound } from "next/navigation";
import { ChannelsPanel } from "./channels-panel";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function ChannelsPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const supabase = await getServerClientFromCookies();
  const { data: channels } = await supabase
    .from("channels")
    .select("id, type, status, phone_number, display_name, ig_username, connected_at")
    .eq("organization_id", org.id)
    .order("connected_at", { ascending: false });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Canais</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte WhatsApp, Instagram e Telegram para atender no Inbox unificado.
        </p>
      </div>

      <ChannelsPanel orgSlug={orgSlug} channels={channels ?? []} />
    </div>
  );
}
