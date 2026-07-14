import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { AesSecretStore, isValidEncryptionKeyHex } from "@/infrastructure/crypto/aes-secret-store";
import { connectChannel } from "@/application/use-cases/connect-channel";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  orgSlug: z.string().min(1),
  type: z.enum(["whatsapp", "instagram"]),
  code: z.string().min(10),
  wabaId: z.string().nullable().optional(),
  igUserId: z.string().nullable().optional(),
});

const META_TOKEN_URL = "https://graph.facebook.com/v21.0/oauth/access_token";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const supabase = await getServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", parsed.data.orgSlug)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ error: "Organização não encontrada." }, { status: 404 });
  }

  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return NextResponse.json({ error: "META_APP_ID/SECRET não configurados." }, { status: 500 });
  }

  // Exchange short-lived code for a long-lived user access token
  const url = new URL(META_TOKEN_URL);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", parsed.data.code);

  const tokenRes = await fetch(url.toString(), { method: "GET" });
  const tokenPayload = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    error?: { message?: string };
  };

  if (!tokenRes.ok || !tokenPayload.access_token) {
    logger.warn("Meta token exchange failed", {
      orgId: org.id,
      status: tokenRes.status,
      error: tokenPayload.error?.message,
    });
    return NextResponse.json(
      { error: tokenPayload.error?.message ?? "Falha ao trocar código por token." },
      { status: 502 },
    );
  }

  const key = process.env.ENCRYPTION_KEY?.trim() ?? "";
  if (!isValidEncryptionKeyHex(key)) {
    return NextResponse.json({ error: "ENCRYPTION_KEY inválida." }, { status: 500 });
  }

  const secretStore = new AesSecretStore(key);
  const result = await connectChannel(supabase, secretStore, {
    orgId: org.id,
    type: parsed.data.type,
    accessToken: tokenPayload.access_token,
    wabaId: parsed.data.wabaId ?? null,
    igUserId: parsed.data.igUserId ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    channelId: result.value.channelId,
    phoneNumber: result.value.phoneNumber,
  });
}
