import { StoreAnalyticsPanel } from "../analytics-panel";

interface Props {
  params: Promise<{ orgSlug: string }>;
}

export default async function StoreAnalyticsPage({ params }: Props) {
  const { orgSlug } = await params;
  return <StoreAnalyticsPanel orgSlug={orgSlug} />;
}
