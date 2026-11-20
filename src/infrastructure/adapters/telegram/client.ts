const TELEGRAM_API = "https://api.telegram.org";

export function telegramMethodUrl(botToken: string, method: string): string {
  return `${TELEGRAM_API}/bot${botToken}/${method}`;
}

type TgResponse<T> = { ok: true; result: T } | { ok: false; description?: string; error_code?: number };

async function call<T>(botToken: string, method: string, body?: unknown): Promise<TgResponse<T>> {
  const res = await fetch(telegramMethodUrl(botToken, method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return ((await res.json().catch(() => null)) ?? { ok: false, error_code: res.status }) as TgResponse<T>;
}

export interface TgBotInfo {
  id: number;
  username?: string;
  first_name?: string;
}

export async function getMe(botToken: string) {
  return call<TgBotInfo>(botToken, "getMe");
}

export async function setWebhook(botToken: string, url: string, secretToken: string) {
  return call<boolean>(botToken, "setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
}

export async function deleteWebhook(botToken: string) {
  return call<boolean>(botToken, "deleteWebhook");
}
