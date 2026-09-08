import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { NewCourseForm } from "./new-course-form";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function NewCoursePage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Novo Curso</h1>
        <p className="text-sm text-muted-foreground mt-1">Preencha as informações básicas. Você adicionará módulos e aulas na próxima etapa.</p>
      </div>
      <NewCourseForm orgSlug={orgSlug} />
    </div>
  );
}
