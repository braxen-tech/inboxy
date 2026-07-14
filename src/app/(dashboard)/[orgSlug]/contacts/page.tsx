import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrgBySlug } from "@/lib/get-org";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";

interface Props {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function ContactsPage({ params, searchParams }: Props) {
  const [{ orgSlug }, { q }] = await Promise.all([params, searchParams]);
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const db = await getServerClientFromCookies();

  let query = db
    .from("contacts")
    .select("id, name, phone, email, ig_username, notes, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (q?.trim()) {
    const like = `%${q.trim()}%`;
    query = query.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like},ig_username.ilike.${like}`);
  }

  const { data: contacts } = await query;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Contatos</h1>
          <p className="text-sm text-muted-foreground">
            {contacts?.length ?? 0} contatos {q ? `para "${q}"` : ""}
          </p>
        </div>
        <form className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nome, telefone, email…"
            className="h-9 w-64 rounded-md border bg-background px-3 text-sm"
          />
        </form>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">WhatsApp</th>
              <th className="px-4 py-2">Instagram</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2 w-32">Criado</th>
            </tr>
          </thead>
          <tbody>
            {(contacts ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum contato encontrado.
                </td>
              </tr>
            )}
            {(contacts ?? []).map((c) => (
              <tr key={c.id} className="border-b hover:bg-muted/30">
                <td className="px-4 py-2">
                  <Link href={`/${orgSlug}/contacts/${c.id}`} className="font-medium hover:underline">
                    {c.name ?? c.phone ?? c.ig_username ?? "Sem nome"}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{c.phone ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{c.ig_username ? `@${c.ig_username}` : "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{c.email ?? "—"}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {new Date(c.created_at as string).toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
