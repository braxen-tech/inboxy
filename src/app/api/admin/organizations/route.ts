import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
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

  // Create auth user via Supabase Auth admin
  const { data: authUser, error: authError } = await db.auth.admin.createUser({
    email: ownerEmail,
    email_confirm: true,
  });

  if (authError) {
    logger.error("Failed to create auth user", { error: authError.message, email: ownerEmail });
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Create organization
  const { data: org, error: orgError } = await db
    .from("organizations")
    .insert({
      name,
      slug,
      owner_user_id: authUser.user.id,
    })
    .select("id, slug")
    .single();

  if (orgError) {
    logger.error("Failed to create organization", { error: orgError.message });
    return NextResponse.json({ error: orgError.message }, { status: 500 });
  }

  // Send magic link
  const { error: magicLinkError } = await db.auth.admin.generateLink({
    type: "magiclink",
    email: ownerEmail,
  });

  if (magicLinkError) {
    logger.warn("Magic link generation failed (org created)", { error: magicLinkError.message });
  }

  await db.from("audit_log").insert({
    organization_id: org.id,
    user_id: authUser.user.id,
    action: "organization.created",
    details: { name, slug, ownerEmail },
  });

  logger.info("Organization created", { orgId: org.id, slug });

  return NextResponse.json({
    id: org.id,
    slug: org.slug,
    ownerUserId: authUser.user.id,
  }, { status: 201 });
}
