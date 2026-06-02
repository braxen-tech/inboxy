import { createClient } from "@supabase/supabase-js";
import { createDecipheriv } from "node:crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const IV_LENGTH = 16;
const TAG_LENGTH = 16;

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
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data: org } = await db
    .from("organizations")
    .select("*")
    .eq("chatwoot_status", "active")
    .single();
  if (!org) throw new Error("no active org");

  const key = process.env.ENCRYPTION_KEY;
  const botTok = org.chatwoot_agent_bot_access_token
    ? decrypt(org.chatwoot_agent_bot_access_token, key)
    : null;
  const userTok = org.chatwoot_api_token ? decrypt(org.chatwoot_api_token, key) : null;
  const base = org.chatwoot_api_url.replace(/\/$/, "");
  const acc = org.chatwoot_account_id;
  const convId = 42;

  async function lastMsgs(token, label) {
    const r = await fetch(
      `${base}/api/v1/accounts/${acc}/conversations/${convId}/messages`,
      { headers: { api_access_token: token } },
    );
    const j = await r.json();
    const list = j.payload ?? j.data ?? j;
    const arr = Array.isArray(list) ? list : [];
    console.log(`\n=== ${label} (http ${r.status}) ===`);
    for (const m of arr.slice(-5)) {
      console.log({
        id: m.id,
        message_type: m.message_type,
        sender_type: m.sender_type ?? m.sender?.type,
        sender_id: m.sender_id ?? m.sender?.id,
        sender_name: m.sender?.name,
        preview: String(m.content ?? "").slice(0, 40),
      });
    }
  }

  console.log("botId", org.chatwoot_agent_bot_id, "hasBotToken", !!botTok);
  if (userTok) await lastMsgs(userTok, "USER_TOKEN");
  if (botTok) await lastMsgs(botTok, "BOT_TOKEN");

  const { data: msgs } = await db
    .from("messages")
    .select("ai_metadata,created_at,content")
    .order("created_at", { ascending: false })
    .limit(5);
  console.log("\n=== DB outbound ===");
  for (const m of msgs ?? []) {
    if (m.ai_metadata)
      console.log({
        at: m.created_at,
        sentAsBot: m.ai_metadata?.sentAsBot,
        preview: m.content?.slice(0, 35),
      });
  }

  if (botTok) {
    const pr = await fetch(`${base}/api/v1/profile`, {
      headers: { api_access_token: botTok },
    });
    console.log("\nBOT profile", pr.status, (await pr.text()).slice(0, 100));

    const body = {
      content: "[inboxy diag private]",
      message_type: "outgoing",
      private: true,
      sender_type: "AgentBot",
      sender_id: Number(org.chatwoot_agent_bot_id),
    };
    const sr = await fetch(
      `${base}/api/v1/accounts/${acc}/conversations/${convId}/messages`,
      {
        method: "POST",
        headers: { api_access_token: botTok, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    console.log("BOT send (private+AgentBot)", sr.status, (await sr.text()).slice(0, 200));
  }

  if (userTok && org.chatwoot_agent_bot_id && process.argv.includes("--fix-token")) {
    const rr = await fetch(
      `${base}/api/v1/accounts/${acc}/agent_bots/${org.chatwoot_agent_bot_id}/reset_access_token`,
      { method: "POST", headers: { api_access_token: userTok } },
    );
    const reset = await rr.json();
    console.log("\nRESET_TOKEN", rr.status, "has access_token:", !!reset.access_token);
    if (reset.access_token && process.env.ENCRYPTION_KEY) {
      const { createCipheriv, randomBytes } = await import("node:crypto");
      const key = Buffer.from(process.env.ENCRYPTION_KEY.trim(), "hex");
      const iv = randomBytes(16);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const enc = Buffer.concat([cipher.update(reset.access_token, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      const stored = Buffer.concat([iv, tag, enc]).toString("base64");
      await db
        .from("organizations")
        .update({ chatwoot_agent_bot_access_token: stored })
        .eq("id", org.id);
      console.log("Saved new bot token to organizations");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
