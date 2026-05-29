import type { SupabaseClient } from "@supabase/supabase-js";
import type { SecretStore } from "@/domain/ports";
import { Ok, Err, type Result } from "@/domain/errors";
import { DomainError } from "@/domain/errors";
import { createStripeClient } from "@/infrastructure/adapters/stripe/client";
import { logger } from "@/lib/logger";

interface ConnectStripeInput {
  orgId: string;
  secretKey: string;
  appUrl: string;
}

const STRIPE_TOOLS = [
  "search_products",
  "get_product_details",
  "add_to_cart",
  "view_cart",
  "remove_from_cart",
  "create_checkout",
];

export async function connectStripe(
  db: SupabaseClient,
  secretStore: SecretStore,
  input: ConnectStripeInput,
): Promise<Result<{ validated: true }, DomainError>> {
  const { orgId, secretKey, appUrl } = input;
  const ctx = { orgId };

  if (!secretKey || !secretKey.startsWith("sk_")) {
    return Err(new DomainError("STRIPE_CONNECT_FAILED" as any, "Informe uma Secret Key válida (sk_live_... ou sk_test_...)."));
  }

  const stripe = createStripeClient(secretKey);

  try {
    await stripe.products.list({ limit: 1 });
  } catch (error) {
    logger.error("Stripe connect validation failed", { ...ctx, error });
    return Err(new DomainError("STRIPE_CONNECT_FAILED" as any, "Chave da API inválida ou sem permissão para listar produtos."));
  }

  let webhookSecret: string;
  try {
    const webhookUrl = `${appUrl}/api/webhooks/stripe/${orgId}`;

    const existingWebhooks = await stripe.webhookEndpoints.list({ limit: 100 });
    for (const wh of existingWebhooks.data) {
      if (wh.url === webhookUrl) {
        await stripe.webhookEndpoints.del(wh.id);
      }
    }

    const endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: [
        "checkout.session.completed",
        "checkout.session.expired",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
      ],
    });

    webhookSecret = endpoint.secret!;
  } catch (error) {
    logger.error("Stripe webhook registration failed", { ...ctx, error });
    return Err(new DomainError("STRIPE_CONNECT_FAILED" as any, "Erro ao registrar webhook no Stripe."));
  }

  const encryptedKey = secretStore.encrypt(secretKey);

  const { data: currentOrg } = await db
    .from("organizations")
    .select("tools_enabled")
    .eq("id", orgId)
    .single();

  const existingTools: string[] = currentOrg?.tools_enabled ?? [];
  const mergedTools = Array.from(new Set([...existingTools, ...STRIPE_TOOLS]));

  const { error: updateError } = await db
    .from("organizations")
    .update({
      stripe_secret_key: encryptedKey,
      stripe_webhook_secret: webhookSecret,
      stripe_status: "active",
      tools_enabled: mergedTools,
    })
    .eq("id", orgId);

  if (updateError) {
    logger.error("Stripe connect: DB update failed", { ...ctx, error: updateError.message, code: updateError.code });
    const hint = updateError.code === "42703"
      ? " Execute a migration 00005_stripe_integration.sql no Supabase."
      : "";
    return Err(new DomainError("STRIPE_CONNECT_FAILED" as any, `Erro ao salvar configuração: ${updateError.message}.${hint}`));
  }

  logger.info("Stripe connected", ctx);
  return Ok({ validated: true });
}

export async function disconnectStripe(
  db: SupabaseClient,
  orgId: string,
): Promise<Result<{ disconnected: true }, DomainError>> {
  const { data: currentOrg } = await db
    .from("organizations")
    .select("tools_enabled")
    .eq("id", orgId)
    .single();

  const existingTools: string[] = currentOrg?.tools_enabled ?? [];
  const filteredTools = existingTools.filter((t) => !STRIPE_TOOLS.includes(t));

  const { error } = await db
    .from("organizations")
    .update({
      stripe_secret_key: null,
      stripe_webhook_secret: null,
      stripe_status: "disconnected",
      tools_enabled: filteredTools,
    })
    .eq("id", orgId);

  if (error) {
    return Err(new DomainError("STRIPE_CONNECT_FAILED" as any, error.message));
  }

  return Ok({ disconnected: true });
}
