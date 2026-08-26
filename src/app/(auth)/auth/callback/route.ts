import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAuthCallbackRedirectTarget } from "@/lib/auth-routes";
import { ensureUserOrganization } from "@/lib/ensure-user-organization";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = getAuthCallbackRedirectTarget(url.searchParams.get("next"));

  const redirectTo = new URL(next, request.url);
  const response = NextResponse.redirect(redirectTo);

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

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      // End users (portal customers) never get an auto-provisioned organization —
      // that flow is only for org owners signing up for the platform itself.
      if (user && user.user_metadata?.role !== "end_user") {
        await ensureUserOrganization(user);
      }
      return response;
    }
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
