/**
 * One-off repair: remove orphan Inboxy agent bots, link active bot to all inboxes,
 * and force recent Telegram conversations into pending for the AI queue.
 *
 * Usage: node scripts/repair-chatwoot-agent-bots.mjs [orgSlug]
 */
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

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.payload)) return data.payload;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function cw(base, path, token, { method = "GET", body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      api_access_token: token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok || res.status === 204, status: res.status, json };
}

async function main() {
  const slug = process.argv[2] ?? "tiago";
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: org, error } = await db
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error || !org) throw new Error(`org ${slug}: ${error?.message}`);
  if (org.chatwoot_status !== "active") throw new Error("chatwoot not active");

  const token = decrypt(org.chatwoot_api_token, process.env.ENCRYPTION_KEY);
  const base = org.chatwoot_api_url.replace(/\/+$/, "");
  const accountId = org.chatwoot_account_id;
  const keepBotId = Number(org.chatwoot_agent_bot_id);

  const botsRes = await cw(base, `/api/v1/accounts/${accountId}/agent_bots`, token);
  const bots = unwrapList(botsRes.json);
  console.log(
    "bots before",
    bots.map((b) => ({ id: b.id, name: b.name, url: b.outgoing_url })),
  );

  for (const bot of bots) {
    const isInboxy =
      typeof bot.outgoing_url === "string" &&
      bot.outgoing_url.includes("/api/webhooks/chatwoot/agent-bot");
    if (!isInboxy || bot.id === keepBotId) continue;
    const del = await cw(
      base,
      `/api/v1/accounts/${accountId}/agent_bots/${bot.id}`,
      token,
      { method: "DELETE" },
    );
    if (!del.ok) {
      await cw(base, `/api/v1/accounts/${accountId}/agent_bots/${bot.id}`, token, {
        method: "PATCH",
        body: { outgoing_url: "" },
      });
      const del2 = await cw(
        base,
        `/api/v1/accounts/${accountId}/agent_bots/${bot.id}`,
        token,
        { method: "DELETE" },
      );
      console.log("deleted orphan bot (retry)", bot.id, del2.status, del2.ok);
    } else {
      console.log("deleted orphan bot", bot.id, del.status, del.ok);
    }
  }

  const inboxesRes = await cw(base, `/api/v1/accounts/${accountId}/inboxes`, token);
  const inboxes = unwrapList(inboxesRes.json);
  for (const inbox of inboxes) {
    const link = await cw(
      base,
      `/api/v1/accounts/${accountId}/inboxes/${inbox.id}/set_agent_bot`,
      token,
      { method: "POST", body: { agent_bot: keepBotId } },
    );
    console.log("link inbox", inbox.id, inbox.name, link.status, link.ok);
  }

  const convsRes = await cw(
    base,
    `/api/v1/accounts/${accountId}/conversations?status=all&assignee_type=all`,
    token,
  );
  const convs = unwrapList(convsRes.json?.data ?? convsRes.json);
  for (const conv of convs.slice(0, 20)) {
    if (conv.status === "pending") continue;
    const toggle = await cw(
      base,
      `/api/v1/accounts/${accountId}/conversations/${conv.id}/toggle_status`,
      token,
      { method: "POST", body: { status: "pending" } },
    );
    console.log("set pending", conv.id, "was", conv.status, toggle.status, toggle.ok, toggle.json);
  }

  console.log("done. keepBotId=", keepBotId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
