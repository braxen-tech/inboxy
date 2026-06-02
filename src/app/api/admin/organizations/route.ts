import { NextResponse } from "next/server";
import { z } from "zod/v4";
import type { User } from "@supabase/supabase-js";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { getAuthCallbackUrl } from "@/lib/app-url";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  ownerEmail: z.email(),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
});

function verifyAdminSecret(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return secret === process.env.ADMIN_SECRET;
}

async function findUserByEmail(email: string): Promise<User | null> {
  const db = getAdminClient();
  const normalized = email.toLowerCase();

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || data.users.length === 0) return null;

    const match = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (match) return match;

    if (data.users.length < 1000) return null;
  }

  return null;
}

async function resolveOwnerUser(email: string): Promise<{ user: User; created: boolean } | { error: string }> {
  const db = getAdminClient();

  const { data: createdUser, error: createError } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (createdUser?.user) {
    return { user: createdUser.user, created: true };
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return { user: existing, created: false };
  }

  return { error: createError?.message ?? "Unable to resolve owner user" };
}

export async function POST(request: Request) {
  if (!verifyAdminSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", details: parsed.error.issues }, { status: 400 });
  }

  const db = getAdminClient();
  const { name, ownerEmail, slug } = parsed.data;

  const ownerResult = await resolveOwnerUser(ownerEmail);
  if ("error" in ownerResult) {
    logger.error("Failed to resolve owner user", { error: ownerResult.error, email: ownerEmail });
    return NextResponse.json({ error: ownerResult.error }, { status: 500 });
  }

  const { user: ownerUser, created: userCreated } = ownerResult;

  const { data: existingOrg } = await db
    .from("organizations")
    .select("id, slug")
    .eq("owner_user_id", ownerUser.id)
    .maybeSingle();

  let org: { id: string; slug: string };

  if (existingOrg) {
    const { data: updatedOrg, error: updateError } = await db
      .from("organizations")
      .update({ name, slug })
      .eq("id", existingOrg.id)
      .select("id, slug")
      .single();

    if (updateError) {
      logger.error("Failed to update organization", { error: updateError.message, ownerUserId: ownerUser.id });
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    org = updatedOrg;
  } else {
    const { data: insertedOrg, error: insertError } = await db
      .from("organizations")
      .insert({
        name,
        slug,
        owner_user_id: ownerUser.id,
      })
      .select("id, slug")
      .single();

    if (insertError) {
      logger.error("Failed to create organization", { error: insertError.message, ownerUserId: ownerUser.id });
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    org = insertedOrg;
  }

  const { error: magicLinkError } = await db.auth.admin.generateLink({
    type: "magiclink",
    email: ownerEmail,
    options: { redirectTo: getAuthCallbackUrl() },
  });

  if (magicLinkError) {
    logger.warn("Magic link generation failed (org ready)", { error: magicLinkError.message });
  }

  await db.from("audit_log").insert({
    organization_id: org.id,
    user_id: ownerUser.id,
    action: existingOrg ? "organization.updated" : "organization.created",
    details: { name, slug, ownerEmail, userCreated },
  });

  logger.info("Organization provisioned", { orgId: org.id, slug, userCreated });

  return NextResponse.json(
    {
      id: org.id,
      slug: org.slug,
      ownerUserId: ownerUser.id,
      userCreated,
      organizationCreated: !existingOrg,
    },
    { status: existingOrg ? 200 : 201 },
  );
}
