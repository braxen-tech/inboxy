import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { logger } from "@/lib/logger";
import { captureServerEvent } from "@/lib/posthog-server";

type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

export function slugFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "org";
  let slug = local.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (slug.length < 2) slug = "org";
  return slug;
}

async function uniqueSlug(baseSlug: string): Promise<string> {
  const db = getAdminClient();
  let slug = baseSlug;

  for (let attempt = 0; attempt < 20; attempt++) {
    const { data } = await db.from("organizations").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug}-${crypto.randomUUID().slice(0, 4)}`;
  }

  return `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Ensures the authenticated user has an owned organization.
 * Idempotent — safe to call on every login for legacy accounts created before auto-provisioning.
 */
export async function ensureUserOrganization(user: AuthUser): Promise<{ slug: string } | null> {
  const db = getAdminClient();

  const { data: existing, error: selectError } = await db
    .from("organizations")
    .select("slug")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (selectError) {
    logger.error("Failed to load user organization", { userId: user.id, error: selectError.message });
    return null;
  }

  if (existing?.slug) {
    return { slug: existing.slug };
  }

  const email = user.email ?? "user@example.com";
  const slug = await uniqueSlug(slugFromEmail(email));
  const name =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
    email.split("@")[0] ||
    "Minha organização";

  const { data: created, error: insertError } = await db
    .from("organizations")
    .insert({ name, slug, owner_user_id: user.id })
    .select("slug")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: retry } = await db
        .from("organizations")
        .select("slug")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (retry?.slug) return { slug: retry.slug };
    }

    logger.error("Failed to create user organization", { userId: user.id, error: insertError.message });
    return null;
  }

  await db.from("audit_log").insert({
    organization_id: null,
    user_id: user.id,
    action: "organization.auto_provisioned",
    details: { slug, email },
  });

  logger.info("Organization auto-provisioned", { userId: user.id, slug });
  captureServerEvent(
    "organization_provisioned",
    { slug, user_id: user.id },
    user.id,
  );
  return created;
}
