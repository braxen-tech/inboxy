import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { InboxView } from "./inbox-view";

interface Props {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ conversation?: string }>;
}

export default async function InboxPage({ params, searchParams }: Props) {
  const [{ orgSlug }, { conversation: selectedId }] = await Promise.all([params, searchParams]);
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = await getServerClientFromCookies();

  const { data: conversations } = await db
    .from("conversations")
    .select(
      `
      id,
      status,
      priority,
      unread_count,
      last_message_at,
      channel_type,
      contact:contacts(id, name, phone, email, avatar_url, ig_username),
      channel:channels(type, display_name, phone_number)
      `,
    )
    .eq("organization_id", org.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);

  const rows = (conversations ?? []).map((c) => {
    const contact = (Array.isArray(c.contact) ? c.contact[0] : c.contact) as {
      id: string;
      name: string | null;
      phone: string | null;
      email: string | null;
      avatar_url: string | null;
      ig_username: string | null;
    } | null;
    const channel = (Array.isArray(c.channel) ? c.channel[0] : c.channel) as {
      type: "whatsapp" | "instagram";
      display_name: string | null;
      phone_number: string | null;
    } | null;

    return {
      id: c.id as string,
      status: (c.status ?? "open") as string,
      priority: (c.priority ?? "normal") as string,
      unreadCount: (c.unread_count ?? 0) as number,
      lastMessageAt: (c.last_message_at ?? null) as string | null,
      channelType: (c.channel_type ?? channel?.type ?? null) as "whatsapp" | "instagram" | null,
      contact: {
        id: contact?.id ?? "",
        name: contact?.name ?? contact?.phone ?? contact?.ig_username ?? "Sem nome",
        subtitle:
          channel?.type === "instagram" && contact?.ig_username
            ? `@${contact.ig_username}`
            : contact?.phone ?? "",
        avatarUrl: contact?.avatar_url ?? null,
      },
    };
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  return (
    <div className="h-[calc(100vh-4rem)] -m-6 sm:-m-8">
      <InboxView
        orgId={org.id}
        orgSlug={orgSlug}
        conversations={rows}
        initialSelectedId={selectedId ?? rows[0]?.id ?? null}
        supabaseUrl={supabaseUrl}
        supabaseAnonKey={supabaseAnonKey}
      />
    </div>
  );
}
