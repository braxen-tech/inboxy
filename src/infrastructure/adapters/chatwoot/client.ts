import { logger } from "@/lib/logger";

interface ChatwootResponse<T> {
  ok: true;
  data: T;
}

interface ChatwootError {
  ok: false;
  status: number;
  error: string;
}

type ChatwootResult<T> = ChatwootResponse<T> | ChatwootError;

export interface ChatwootProfile {
  id: number;
  name: string;
  email: string;
}

export interface ChatwootWebhook {
  id: number;
  url: string;
  subscriptions: string[];
  account_id: number;
}

export interface ChatwootMessageResponse {
  id: number;
  content: string;
  message_type: string;
  conversation_id: number;
}

async function chatwootFetch<T>(
  baseUrl: string,
  path: string,
  apiToken: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
): Promise<ChatwootResult<T>> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const { method = "GET", body } = options;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        api_access_token: apiToken,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json();

    if (!res.ok) {
      const errMsg = json?.error ?? json?.message ?? JSON.stringify(json);
      logger.error("Chatwoot API error", { url, status: res.status, error: errMsg });
      return { ok: false, status: res.status, error: errMsg };
    }

    return { ok: true, data: json as T };
  } catch (err) {
    logger.error("Chatwoot API network error", { url, error: String(err) });
    return { ok: false, status: 0, error: String(err) };
  }
}

export class ChatwootClient {
  constructor(
    private apiUrl: string,
    private apiToken: string,
  ) {}

  async getProfile(): Promise<ChatwootResult<ChatwootProfile>> {
    return chatwootFetch<ChatwootProfile>(this.apiUrl, "/auth/sign_in", this.apiToken, {
      method: "POST",
      body: {},
    }).then((res) => {
      if (!res.ok) {
        return chatwootFetch<ChatwootProfile>(this.apiUrl, "/api/v1/profile", this.apiToken);
      }
      return res;
    });
  }

  async validateToken(): Promise<ChatwootResult<ChatwootProfile>> {
    return chatwootFetch<ChatwootProfile>(this.apiUrl, "/api/v1/profile", this.apiToken);
  }

  async createWebhook(
    accountId: string,
    webhookUrl: string,
    subscriptions: string[] = ["message_created"],
  ): Promise<ChatwootResult<ChatwootWebhook>> {
    return chatwootFetch<ChatwootWebhook>(
      this.apiUrl,
      `/api/v1/accounts/${accountId}/webhooks`,
      this.apiToken,
      {
        method: "POST",
        body: {
          webhook: {
            url: webhookUrl,
            subscriptions,
          },
        },
      },
    );
  }

  async listWebhooks(accountId: string): Promise<ChatwootResult<ChatwootWebhook[]>> {
    return chatwootFetch<ChatwootWebhook[]>(
      this.apiUrl,
      `/api/v1/accounts/${accountId}/webhooks`,
      this.apiToken,
    );
  }

  async deleteWebhook(accountId: string, webhookId: number): Promise<ChatwootResult<void>> {
    return chatwootFetch<void>(
      this.apiUrl,
      `/api/v1/accounts/${accountId}/webhooks/${webhookId}`,
      this.apiToken,
      { method: "DELETE" },
    );
  }

  async sendMessage(
    accountId: string,
    conversationId: number,
    content: string,
  ): Promise<ChatwootResult<ChatwootMessageResponse>> {
    return chatwootFetch<ChatwootMessageResponse>(
      this.apiUrl,
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      this.apiToken,
      {
        method: "POST",
        body: {
          content,
          message_type: "outgoing",
          private: false,
        },
      },
    );
  }
}
