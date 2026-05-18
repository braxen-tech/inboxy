import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Prefer passing url + anonKey from a Server Component (props or layout).
 * Relying on `process.env.NEXT_PUBLIC_*` inside bundled client modules is flaky with Turbopack
 * because values can stay stale across restarts unless `.next` is cleared.
 */
export function createSupabaseBrowserClient(url: string, anonKey: string): SupabaseClient {
  const u = url?.trim();
  const k = anonKey?.trim();
  if (!u || !k || u.includes("placeholder")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing or invalid. Check .env.local and restart dev with `rm -rf .next`.",
    );
  }
  return createBrowserClient(u, k);
}
