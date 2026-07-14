"use server";

import { z } from "zod/v4";
import { revalidatePath } from "next/cache";
import { getServerClientFromCookies } from "@/infrastructure/repositories/supabase-clients";
import { AesSecretStore } from "@/infrastructure/crypto/aes-secret-store";
import { WhatsAppCloudAdapter } from "@/infrastructure/adapters/whatsapp-cloud";
import { InstagramDmAdapter } from "@/infrastructure/adapters/instagram-dm";
import { logger } from "@/lib/logger";

async function requireUser() {
  const supabase = await getServerClientFromCookies();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." as const, supabase };
  return { supabase, user };
}

const sendSchema = z.object({
  orgSlug: z.string().min(1),
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(4000),
  isInternalNote: z.boolean().optional().default(false),
});

export async function sendOutboundMessage(raw: {
  orgSlug: string;
  conversationId: string;
  content: string;
  isInternalNote?: boolean;
}) {
  const parsed = sendSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const { supabase, user, error } = await requireUser();
  if (error || !user) return { error: error ?? "Não autenticado." };

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", parsed.data.orgSlug)
    .maybeSingle();
  if (!org) return { error: "Organização não encontrada." };

  const { data: convo } = await supabase
    .from("conversations")
    .select("id, external_conversation_id, channels(*)")
    .eq("id", parsed.data.conversationId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!convo) return { error: "Conversa não encontrada." };

  const isInternal = parsed.data.isInternalNote;

  if (isInternal) {
    const { error: insErr } = await supabase.from("messages").insert({
      organization_id: org.id,
      conversation_id: convo.id,
      direction: "outbound",
      content: parsed.data.content,
      message_type: "text",
      is_internal_note: true,
      sender_user_id: user.id,
      status: "replied",
    });
    if (insErr) return { error: insErr.message };
    revalidatePath(`/${parsed.data.orgSlug}/inbox`);
    return { success: true as const };
  }

  const channel = (Array.isArray(convo.channels) ? convo.channels[0] : convo.channels) as {
    type: "whatsapp" | "instagram";
    status: string;
    access_token: string | null;
    phone_number_id: string | null;
    ig_user_id: string | null;
  } | null;

  if (!channel || channel.status !== "active" || !channel.access_token) {
    return { error: "Canal desta conversa não está ativo." };
  }

  const encKey = process.env.ENCRYPTION_KEY?.trim() ?? "";
  const secretStore = new AesSecretStore(encKey);
  let accessToken: string;
  try {
    accessToken = secretStore.decrypt(channel.access_token);
  } catch {
    return { error: "Não foi possível ler credencial do canal." };
  }

  const adapter = channel.type === "whatsapp" ? new WhatsAppCloudAdapter() : new InstagramDmAdapter();
  const fromExternalId = channel.type === "whatsapp" ? channel.phone_number_id : channel.ig_user_id;
  const toExternalId = convo.external_conversation_id;
  if (!fromExternalId || !toExternalId) {
    return { error: "Conversa sem identificador externo." };
  }

  const send = await adapter.send({
    accessToken,
    fromExternalId,
    toExternalId,
    content: parsed.data.content,
  });

  if (!send.ok) {
    logger.warn("Manual send failed", { orgId: org.id, error: send.error });
    return { error: send.error.message };
  }

  await supabase.from("messages").insert({
    organization_id: org.id,
    conversation_id: convo.id,
    direction: "outbound",
    content: parsed.data.content,
    message_type: "text",
    is_internal_note: false,
    sender_user_id: user.id,
    external_message_id: `${channel.type}:${send.value}`,
    status: "replied",
  });

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString(), status: "open", assigned_to: user.id })
    .eq("id", convo.id);

  revalidatePath(`/${parsed.data.orgSlug}/inbox`);
  return { success: true as const };
}

const statusSchema = z.object({
  orgSlug: z.string().min(1),
  conversationId: z.string().uuid(),
  status: z.enum(["pending", "open", "snoozed", "resolved", "closed"]),
});

export async function updateConversationStatus(raw: z.infer<typeof statusSchema>) {
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) return { error: "Dados inválidos." };

  const { supabase, user, error } = await requireUser();
  if (error || !user) return { error: error ?? "Não autenticado." };

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", parsed.data.orgSlug)
    .maybeSingle();
  if (!org) return { error: "Organização não encontrada." };

  const { error: upErr } = await supabase
    .from("conversations")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.conversationId)
    .eq("organization_id", org.id);

  if (upErr) return { error: upErr.message };

  await supabase.from("activities").insert({
    organization_id: org.id,
    entity_type: "conversation",
    entity_id: parsed.data.conversationId,
    user_id: user.id,
    type: "status_changed",
    content: `Status alterado para ${parsed.data.status}`,
    metadata: { status: parsed.data.status },
  });

  revalidatePath(`/${parsed.data.orgSlug}/inbox`);
  return { success: true as const };
}
