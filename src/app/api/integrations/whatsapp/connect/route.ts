import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { getAdminClient } from "@/infrastructure/repositories/supabase-clients";
import { AesSecretStore } from "@/infrastructure/crypto/aes-secret-store";
import { connectWhatsApp } from "@/application/use-cases/connect-whatsapp";

const bodySchema = z.object({
  orgId: z.string().uuid(),
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const db = getAdminClient();
  const secretStore = new AesSecretStore(process.env.ENCRYPTION_KEY!);

  const result = await connectWhatsApp(db, secretStore, {
    orgId: parsed.data.orgId,
    code: parsed.data.code,
    wabaId: parsed.data.wabaId,
    phoneNumberId: parsed.data.phoneNumberId,
    appId: process.env.META_APP_ID!,
    appSecret: process.env.META_APP_SECRET!,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({
    phoneNumber: result.value.phoneNumber,
    verifiedName: result.value.verifiedName,
  });
}
