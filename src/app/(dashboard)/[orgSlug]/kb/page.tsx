import { getOrgBySlug } from "@/lib/get-org";
import { notFound } from "next/navigation";
import { KbEditor } from "./kb-editor";
import { KbDocuments } from "./kb-documents";
import { listKbDocuments } from "./actions";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function KbPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const docsResult = await listKbDocuments(orgSlug);
  const documents = docsResult.documents ?? [];
  const usage = docsResult.usage ?? {
    fileCount: 0,
    totalBytes: 0,
    maxFiles: 5,
    maxTotalBytes: 25 * 1024 * 1024,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Base de conhecimento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escreva informações essenciais e envie documentos. O agente usa o texto abaixo diretamente
          e consulta os documentos indexados quando necessário.
        </p>
      </div>

      <KbDocuments orgSlug={orgSlug} initialDocuments={documents} initialUsage={usage} />

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Texto manual</h2>
        <KbEditor orgId={org.id} orgSlug={orgSlug} initialValue={org.knowledge_base ?? ""} />
      </div>
    </div>
  );
}
