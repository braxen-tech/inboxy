import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { needsBillingSetup } from "@/lib/billing-setup";
import {
  getAuthCallbackRedirectTarget,
  isAuthPublicPath,
  isReservedAppSlug,
} from "@/lib/auth-routes";

const DASHBOARD_SECTIONS = new Set(["kb", "agent", "integrations", "settings"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAuthPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    const secret = request.headers.get("x-admin-secret");
    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(cookies) {
          for (const { name, value, options } of cookies) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 1 && !isReservedAppSlug(segments[0])) {
    const orgSlug = segments[0];
    const section = segments[1];
    const needsRedirect =
      !section ||
      (section && DASHBOARD_SECTIONS.has(section));

    if (needsRedirect && section !== "billing") {
      try {
        const db = getAdminClient();
        const { data: org } = await db
          .from("organizations")
          .select("id, subscription_id, owner_user_id")
          .eq("slug", orgSlug)
          .maybeSingle();

        if (org && org.owner_user_id === user.id && needsBillingSetup(org)) {
          const billingUrl = new URL(`/${orgSlug}/billing`, request.url);
          billingUrl.searchParams.set("setup", "required");
          return NextResponse.redirect(billingUrl);
        }
      } catch {
        // Allow request through if billing check fails (e.g. missing env in edge)
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
