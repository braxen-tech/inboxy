/**
 * Minimal Telegram Bot API client (text MVP).
 * https://core.telegram.org/bots/api
 */

const TELEGRAM_API = "https://api.telegram.org";

export interface TelegramApiError {
  status: number;
  message: string;
  code?: number;
}

async function telegramCall<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: TelegramApiError }> {
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await res.text();
  let parsed: { ok?: boolean; result?: T; description?: string; error_code?: number } | null = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    // keep raw
  }

  if (!res.ok || !parsed?.ok) {
    return {
      ok: false,
      error: {
        status: res.status,
        message: parsed?.description ?? raw ?? `HTTP ${res.status}`,
        code: parsed?.error_code,
      },
    };
  }

  return { ok: true, data: parsed.result as T };
}

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export async function telegramGetMe(token: string) {
  return telegramCall<TelegramUser>(token, "getMe");
}

export async function telegramSetWebhook(
  token: string,
  url: string,
  secretToken: string,
) {
  return telegramCall<{ url?: string }>(token, "setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
}

export async function telegramDeleteWebhook(token: string) {
  return telegramCall<{ url?: string } | true>(token, "deleteWebhook", {
    drop_pending_updates: false,
  });
}

export async function telegramSendMessage(token: string, chatId: string, text: string) {
  return telegramCall<{ message_id: number }>(token, "sendMessage", {
    chat_id: chatId,
    text,
  });
}
