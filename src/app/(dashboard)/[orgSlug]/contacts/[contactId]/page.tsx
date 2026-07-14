import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrgBySlug } from "@/lib/get-org";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { ContactEditor } from "./contact-editor";

interface Props {
  params: Promise<{ orgSlug: string; contactId: string }>;
}

export default async function ContactDetailPage({ params }: Props) {
  const { orgSlug, contactId } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = await getServerClientFromCookies();

  const { data: contact } = await db
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!contact) notFound();

  const [{ data: convos }, { data: activities }] = await Promise.all([
    db
      .from("conversations")
      .select("id, status, last_message_at, channel_type")
      .eq("organization_id", org.id)
      .eq("contact_id", contactId)
      .order("last_message_at", { ascending: false })
      .limit(20),
    db
      .from("activities")
      .select("id, type, content, created_at, metadata")
      .eq("organization_id", org.id)
      .eq("entity_type", "contact")
      .eq("entity_id", contactId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href={`/${orgSlug}/contacts`} className="text-xs text-muted-foreground hover:underline">
          ← Todos os contatos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {(contact.name as string | null) ?? (contact.phone as string | null) ?? "Sem nome"}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ContactEditor
            orgSlug={orgSlug}
            contact={{
              id: contact.id as string,
              name: (contact.name as string | null) ?? "",
              email: (contact.email as string | null) ?? "",
              phone: (contact.phone as string | null) ?? "",
              ig_username: (contact.ig_username as string | null) ?? "",
              notes: (contact.notes as string | null) ?? "",
            }}
          />

          <section className="rounded-lg border p-4">
            <h2 className="mb-3 text-sm font-medium">Atividade</h2>
            {(activities ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem atividades ainda.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(activities ?? []).map((a) => (
                  <li key={a.id as string} className="flex justify-between gap-3 border-b pb-2">
                    <span>
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        {a.type as string}
                      </span>
                      <span className="ml-2">{(a.content as string | null) ?? ""}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(a.created_at as string).toLocaleString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-3">
          <div className="rounded-lg border p-4">
            <h2 className="mb-2 text-sm font-medium">Conversas</h2>
            {(convos ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conversa.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(convos ?? []).map((c) => (
                  <li key={c.id as string}>
                    <Link
                      href={`/${orgSlug}/inbox?conversation=${c.id}`}
                      className="flex items-center justify-between hover:underline"
                    >
                      <span className="capitalize">{c.channel_type as string} · {c.status as string}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.last_message_at
                          ? new Date(c.last_message_at as string).toLocaleDateString("pt-BR")
                          : "—"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
