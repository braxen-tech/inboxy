import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

let _adminClient: SupabaseClient | null = null;

/**
 * Admin client with service role key — server-only (webhooks, Inngest workers, admin endpoints).
 * Bypasses RLS.
 */
export function getAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient;

  _adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  return _adminClient;
}

/**
 * Server client for use in Server Components / Server Actions / Route Handlers.
 * Reads auth cookies from the request — RLS-aware.
 */
export async function getServerClientFromCookies(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(newCookies) {
          for (const { name, value, options } of newCookies) {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // setAll can fail in Server Components (read-only). That's expected.
            }
          }
        },
      },
    },
  );
}
