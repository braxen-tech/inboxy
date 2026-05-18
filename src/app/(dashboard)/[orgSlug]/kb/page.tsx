import { getOrgBySlug } from "@/lib/get-org";
import { notFound } from "next/navigation";
import { KbEditor } from "./kb-editor";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function KbPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Knowledge Base</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escreva tudo que o agente precisa saber sobre o seu negócio. Use markdown para organizar.
        </p>
      </div>
      <KbEditor orgId={org.id} orgSlug={orgSlug} initialValue={org.knowledge_base ?? ""} />
    </div>
  );
}
