import { notFound, redirect } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { NewMentoringForm } from "./new-mentoring-form";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function NewMentoringPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  if (!org.cal_event_type_id) {
    redirect(`/${orgSlug}/integrations`);
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Nova Mentoria</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preencha as informações. O agendamento usa o Cal.com configurado nas integrações.
        </p>
      </div>
      <NewMentoringForm orgSlug={orgSlug} />
    </div>
  );
}
