/**
 * Renames the active org's Chatwoot Agent Bot to the product display name.
 * Usage: node scripts/rename-chatwoot-agent-bot.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createDecipheriv } from "node:crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const BOT_NAME = "Assistente Inboxy";
const BOT_DESCRIPTION =
  "Agente de IA Inboxy — atende automaticamente e faz handoff quando necessário";

function decrypt(ciphertext, hexKey) {
  const key = Buffer.from(hexKey.trim(), "hex");
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!url || !serviceKey || !encryptionKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or ENCRYPTION_KEY");
  }

  const db = createClient(url, serviceKey);
  const slug = process.argv[2] ?? "tiago";

  const { data: org, error } = await db
    .from("organizations")
    .select(
      "id, name, slug, chatwoot_status, chatwoot_api_url, chatwoot_api_token, chatwoot_account_id, chatwoot_agent_bot_id",
    )
    .eq("slug", slug)
    .single();

  if (error || !org) throw new Error(`Org not found: ${slug} (${error?.message})`);
  if (org.chatwoot_status !== "active") throw new Error(`Org ${slug} chatwoot_status=${org.chatwoot_status}`);
  if (!org.chatwoot_api_token || !org.chatwoot_agent_bot_id) {
    throw new Error("Missing chatwoot_api_token or chatwoot_agent_bot_id");
  }

  const apiToken = decrypt(org.chatwoot_api_token, encryptionKey);
  const base = org.chatwoot_api_url.replace(/\/+$/, "");
  const accountId = org.chatwoot_account_id;
  const botId = org.chatwoot_agent_bot_id;

  const patchUrl = `${base}/api/v1/accounts/${accountId}/agent_bots/${botId}`;
  const res = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      api_access_token: apiToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: BOT_NAME,
      description: BOT_DESCRIPTION,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Chatwoot PATCH failed", res.status, body);
    process.exit(1);
  }

  console.log("Renamed Agent Bot:", {
    org: org.slug,
    accountId,
    botId,
    name: body.name ?? BOT_NAME,
    description: body.description ?? BOT_DESCRIPTION,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
