import { NextRequest, NextResponse } from "next/server";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_PERSONAL_API_KEY = process.env.POSTHOG_PERSONAL_API_KEY ?? "";
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "";

async function hogql(query: string) {
  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PostHog query failed: ${res.status} — ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.results as unknown[][];
}

export async function GET(req: NextRequest) {
  if (!POSTHOG_KEY || !POSTHOG_PERSONAL_API_KEY || !POSTHOG_PROJECT_ID) {
    return NextResponse.json({ error: "PostHog não configurado. Verifique POSTHOG_PERSONAL_API_KEY e POSTHOG_PROJECT_ID." }, { status: 503 });
  }

  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const orgSlug = req.nextUrl.searchParams.get("orgSlug");
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "7");
  if (!orgSlug) return NextResponse.json({ error: "orgSlug obrigatório." }, { status: 400 });

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) return NextResponse.json({ error: "Org não encontrada." }, { status: 404 });

  const orgId = org.id;
  const since = `now() - interval ${days} day`;

  try {
    const [viewsRows, clicksRows, chatsRows, dailyRows] = await Promise.all([
      // Total page views
      hogql(`SELECT count() FROM events WHERE event = 'store_page_view' AND properties.org_id = '${orgId}' AND timestamp >= ${since}`),
      // Clicks per block
      hogql(`SELECT properties.block_id, properties.block_title, properties.block_type, count() as clicks FROM events WHERE event = 'store_block_click' AND properties.org_id = '${orgId}' AND timestamp >= ${since} GROUP BY properties.block_id, properties.block_title, properties.block_type ORDER BY clicks DESC`),
      // Total chat opens
      hogql(`SELECT count() FROM events WHERE event = 'store_chat_opened' AND properties.org_id = '${orgId}' AND timestamp >= ${since}`),
      // Daily page views
      hogql(`SELECT toDate(timestamp) as day, count() as views FROM events WHERE event = 'store_page_view' AND properties.org_id = '${orgId}' AND timestamp >= ${since} GROUP BY day ORDER BY day ASC`),
    ]);

    const totalViews = Number(viewsRows?.[0]?.[0] ?? 0);
    const totalChats = Number(chatsRows?.[0]?.[0] ?? 0);
    const totalClicks = clicksRows.reduce((sum, r) => sum + Number(r[3] ?? 0), 0);

    return NextResponse.json({
      totalViews,
      totalClicks,
      totalChats,
      ctr: totalViews > 0 ? Math.round((totalClicks / totalViews) * 100) : 0,
      blockClicks: clicksRows.map((r) => ({
        blockId: r[0],
        blockTitle: r[1],
        blockType: r[2],
        clicks: Number(r[3]),
        ctr: totalViews > 0 ? Math.round((Number(r[3]) / totalViews) * 100) : 0,
      })),
      dailyViews: dailyRows.map((r) => ({ day: r[0], views: Number(r[1]) })),
    });
  } catch (err) {
    console.error("PostHog analytics error:", err);
    return NextResponse.json({ error: "Erro ao buscar analytics." }, { status: 500 });
  }
}
