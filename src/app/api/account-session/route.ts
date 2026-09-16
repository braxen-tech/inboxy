import { NextRequest, NextResponse } from "next/server";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { createAccountSession } from "@/infrastructure/adapters/stripe";

export async function POST(req: NextRequest) {
  const supabase = await getServerClientFromCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { orgSlug, components } = body as { orgSlug?: string; components?: Record<string, unknown> };

  if (!orgSlug) {
    return NextResponse.json({ error: "orgSlug required" }, { status: 400 });
  }

  const db = getAdminClient();
  const { data: org } = await db
    .from("organizations")
    .select("id, stripe_account_id, owner_user_id")
    .eq("slug", orgSlug)
    .single();

  if (!org || org.owner_user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!org.stripe_account_id) {
    return NextResponse.json({ error: "Stripe account not configured" }, { status: 422 });
  }

  const defaultComponents = components ?? {
    account_onboarding: { enabled: true },
  };

  try {
    const clientSecret = await createAccountSession(org.stripe_account_id, defaultComponents);
    return NextResponse.json({ clientSecret });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
