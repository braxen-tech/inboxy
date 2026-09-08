import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function PortalCoursesPage({ params }: Props) {
  const { orgSlug } = await params;
  redirect(`/portal/${orgSlug}/library`);
}
