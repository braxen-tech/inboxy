/**
 * Validates the Inboxy Meta App configuration by hitting the Graph API.
 *
 * Reads credentials from .env.local (via dotenv) and prints a checklist
 * with ✓ / ✗ for each requirement so we can tell at a glance whether the
 * Meta side of Embedded Signup v4 is ready.
 *
 * Run:  npx tsx scripts/validate-meta-config.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Prefer .env.local over any shell-exported Meta vars (common when switching apps).
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const GRAPH = "https://graph.facebook.com/v21.0";

const APP_ID = process.env.META_APP_ID?.trim();
const APP_SECRET = process.env.META_APP_SECRET?.trim();
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();
const CONFIG_ID = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID?.trim();
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim();

type CheckResult = { ok: boolean; label: string; detail?: string };
const results: CheckResult[] = [];

function pass(label: string, detail?: string) {
  results.push({ ok: true, label, detail });
}
function fail(label: string, detail?: string) {
  results.push({ ok: false, label, detail });
}

async function graphGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, payload };
}

async function main() {
  console.log("\n▶ Validando configuração Meta do Inboxy\n");

  // ─── 1. Env vars presentes ────────────────────────────────────────
  if (APP_ID) pass("META_APP_ID configurado", APP_ID);
  else fail("META_APP_ID ausente");

  if (APP_SECRET) pass("META_APP_SECRET configurado", "•".repeat(APP_SECRET.length));
  else fail("META_APP_SECRET ausente");

  if (VERIFY_TOKEN) pass("META_WEBHOOK_VERIFY_TOKEN configurado", `${VERIFY_TOKEN.slice(0, 8)}…`);
  else fail("META_WEBHOOK_VERIFY_TOKEN ausente");

  if (CONFIG_ID) pass("NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID configurado", CONFIG_ID);
  else fail("NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID ausente");

  if (APP_URL) pass("NEXT_PUBLIC_APP_URL configurado", APP_URL);
  else fail("NEXT_PUBLIC_APP_URL ausente (webhook precisa de URL pública HTTPS)");

  if (!APP_ID || !APP_SECRET) {
    printResults();
    console.log("\n✗ Não é possível continuar sem APP_ID/APP_SECRET.\n");
    process.exit(1);
  }

  const appToken = `${APP_ID}|${APP_SECRET}`;

  // ─── 2. App existe e é acessível ─────────────────────────────────
  const appInfo = await graphGet(`/${APP_ID}`, {
    fields: "id,name,category,namespace,link",
    access_token: appToken,
  });
  if (appInfo.ok && appInfo.payload.id === APP_ID) {
    pass(
      "App acessível na Graph API",
      `${appInfo.payload.name as string} · ${appInfo.payload.category as string}`,
    );
  } else {
    fail("App inacessível", JSON.stringify(appInfo.payload));
  }

  // ─── 3. Webhook subscriptions (whatsapp_business_account & instagram) ─
  for (const object of ["whatsapp_business_account", "instagram"] as const) {
    const subs = await graphGet(`/${APP_ID}/subscriptions`, { access_token: appToken });
    if (!subs.ok) {
      fail(`Webhook subscriptions (${object})`, JSON.stringify(subs.payload));
      break;
    }
    const list = (subs.payload.data as Array<{ object: string; callback_url?: string; fields?: Array<{ name: string }> }>) ?? [];
    const match = list.find((s) => s.object === object);
    if (!match) {
      fail(`Webhook subscription para "${object}"`, "Nenhuma subscription encontrada — configure no App Dashboard");
    } else {
      const fieldNames = match.fields?.map((f) => f.name).join(", ") ?? "(sem fields)";
      pass(
        `Webhook "${object}" inscrito`,
        `${match.callback_url ?? "sem callback_url"} · fields: ${fieldNames}`,
      );

      // Confirmar que callback aponta pro APP_URL
      if (APP_URL && match.callback_url && !match.callback_url.startsWith(APP_URL)) {
        fail(
          `Callback URL de "${object}" NÃO aponta para NEXT_PUBLIC_APP_URL`,
          `esperado começar com ${APP_URL} · atual: ${match.callback_url}`,
        );
      }
    }
  }

  // ─── 4. Verify token funciona (self-test do próprio endpoint) ─────
  if (APP_URL && VERIFY_TOKEN) {
    const challenge = `test-${Date.now()}`;
    const url = new URL(`${APP_URL}/api/webhooks/meta`);
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", VERIFY_TOKEN);
    url.searchParams.set("hub.challenge", challenge);
    try {
      const res = await fetch(url.toString());
      const body = await res.text();
      if (res.ok && body.trim() === challenge) {
        pass("Verify token responde corretamente no endpoint /api/webhooks/meta");
      } else {
        fail(
          "Verify token FALHOU no endpoint",
          `status ${res.status} · body: ${body.slice(0, 120)}`,
        );
      }
    } catch (err) {
      fail("Não consegui chamar o webhook endpoint", String(err));
    }
  }

  // ─── 5. Configuration ID válido? (não há endpoint público — só checamos que existe) ─
  if (CONFIG_ID) {
    pass(
      "Configuration ID presente",
      "Meta não expõe endpoint público de validação — verifique no Dashboard: WhatsApp → Configuration",
    );
  }

  printResults();

  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) {
    console.log("\n✓ Tudo pronto! Você pode acionar o Embedded Signup na UI.\n");
    process.exit(0);
  } else {
    console.log(`\n✗ ${failed.length} verificação(ões) falhou/falharam. Corrija e rode novamente.\n`);
    process.exit(1);
  }
}

function printResults() {
  console.log("");
  for (const r of results) {
    const icon = r.ok ? "✓" : "✗";
    console.log(`  ${icon} ${r.label}`);
    if (r.detail) console.log(`    ${r.detail}`);
  }
}

main().catch((err) => {
  console.error("\nErro fatal:", err);
  process.exit(1);
});
