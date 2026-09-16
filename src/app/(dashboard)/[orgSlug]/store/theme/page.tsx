import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/lib/get-org";
import { parseStoreTheme } from "@/lib/store-theme";
import { StoreTemaEditor } from "../tema-editor";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function StoreThemePage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const theme = parseStoreTheme(org.store_theme);

  return <StoreTemaEditor orgSlug={orgSlug} initialTheme={theme} />;
}
