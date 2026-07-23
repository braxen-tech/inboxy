import { createClient } from "@supabase/supabase-js";
import { createDecipheriv } from "node:crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const IV = 16;
const TAG = 16;

function decrypt(ciphertext, hexKey) {
  const key = Buffer.from(hexKey.trim(), "hex");
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV);
  const tag = buf.subarray(IV, IV + TAG);
  const encrypted = buf.subarray(IV + TAG);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: org } = await db.from("organizations").select("*").eq("slug", "tiago").single();
const tok = decrypt(org.chatwoot_api_token, process.env.ENCRYPTION_KEY);
const base = org.chatwoot_api_url.replace(/\/$/, "");
const acc = org.chatwoot_account_id;

const botsRes = await fetch(`${base}/api/v1/accounts/${acc}/agent_bots`, {
  headers: { api_access_token: tok },
});
const bots = await botsRes.json();
console.log("DB bot id", org.chatwoot_agent_bot_id);
console.log("BOTS status", botsRes.status);
const botList = bots.payload ?? bots.data ?? bots;
console.log(
  "BOTS",
  JSON.stringify(
    (Array.isArray(botList) ? botList : []).map((b) => ({
      id: b.id,
      name: b.name,
      outgoing_url: b.outgoing_url,
      description: b.description,
    })),
    null,
    2,
  ),
);

const inboxesRes = await fetch(`${base}/api/v1/accounts/${acc}/inboxes`, {
  headers: { api_access_token: tok },
});
const inboxes = await inboxesRes.json();
const inboxList = inboxes.payload ?? inboxes.data ?? inboxes;
for (const ib of Array.isArray(inboxList) ? inboxList : []) {
  const r = await fetch(`${base}/api/v1/accounts/${acc}/inboxes/${ib.id}/agent_bot`, {
    headers: { api_access_token: tok },
  });
  const body = await r.json().catch(() => ({}));
  console.log("INBOX", {
    id: ib.id,
    name: ib.name,
    channel: ib.channel_type ?? ib.medium ?? ib.channel?.type,
    agentBotHttp: r.status,
    agentBot: body?.id ?? body?.payload?.id ?? body,
  });
}

const convs = await fetch(
  `${base}/api/v1/accounts/${acc}/conversations?status=all&assignee_type=all`,
  { headers: { api_access_token: tok } },
).then((r) => r.json());
const payload = convs.data?.payload ?? convs.payload ?? [];
console.log(
  "RECENT CONVS",
  (Array.isArray(payload) ? payload : []).slice(0, 8).map((c) => ({
    id: c.id,
    status: c.status,
    inbox_id: c.inbox_id,
    meta: c.meta?.sender?.name,
  })),
);

const { data: dbConvs } = await db
  .from("conversations")
  .select("id, status, chatwoot_conversation_id, chatwoot_channel, chatwoot_inbox_id, updated_at")
  .eq("organization_id", org.id)
  .order("updated_at", { ascending: false })
  .limit(10);
console.log("DB CONVS", dbConvs);
