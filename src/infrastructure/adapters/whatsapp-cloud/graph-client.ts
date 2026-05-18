import { logger } from "@/lib/logger";

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

interface GraphResponse<T> {
  ok: true;
  data: T;
}

interface GraphError {
  ok: false;
  status: number;
  error: { message: string; type: string; code: number };
}

type GraphResult<T> = GraphResponse<T> | GraphError;

export async function graphFetch<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "DELETE";
    accessToken: string;
    body?: Record<string, unknown>;
  },
): Promise<GraphResult<T>> {
  const url = `${GRAPH_API_BASE}${path}`;
  const { method = "GET", accessToken, body } = options;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json();

    if (!res.ok) {
      logger.error("Graph API error", { url, status: res.status, error: json.error });
      return { ok: false, status: res.status, error: json.error };
    }

    return { ok: true, data: json as T };
  } catch (err) {
    logger.error("Graph API network error", { url, error: String(err) });
    return {
      ok: false,
      status: 0,
      error: { message: String(err), type: "NetworkError", code: 0 },
    };
  }
}

export async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
): Promise<GraphResult<{ access_token: string }>> {
  const url = `${GRAPH_API_BASE}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, status: res.status, error: json.error };
    }
    return { ok: true, data: json };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: { message: String(err), type: "NetworkError", code: 0 },
    };
  }
}

export async function subscribeApp(
  wabaId: string,
  accessToken: string,
): Promise<GraphResult<{ success: boolean }>> {
  return graphFetch(`/${wabaId}/subscribed_apps`, {
    method: "POST",
    accessToken,
  });
}

export async function registerPhoneNumber(
  phoneNumberId: string,
  pin: string,
  accessToken: string,
): Promise<GraphResult<{ success: boolean }>> {
  return graphFetch(`/${phoneNumberId}/register`, {
    method: "POST",
    accessToken,
    body: { messaging_product: "whatsapp", pin },
  });
}

export async function getPhoneNumber(
  phoneNumberId: string,
  accessToken: string,
): Promise<GraphResult<{ display_phone_number: string; verified_name: string }>> {
  return graphFetch(`/${phoneNumberId}?fields=display_phone_number,verified_name`, {
    accessToken,
  });
}

export async function sendTextMessage(
  phoneNumberId: string,
  to: string,
  text: string,
  accessToken: string,
): Promise<GraphResult<{ messages: Array<{ id: string }> }>> {
  return graphFetch(`/${phoneNumberId}/messages`, {
    method: "POST",
    accessToken,
    body: {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    },
  });
}
