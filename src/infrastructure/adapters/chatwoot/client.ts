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

export interface ChatwootAgentBot {
  id: number;
  name: string;
  outgoing_url: string | null;
  access_token?: string;
}

export type ChatwootConversationStatus = "pending" | "open" | "resolved" | "snoozed";

export interface ChatwootInboxSummary {
  id: number;
  name: string;
}

/** Unwrap Chatwoot list responses (`payload` / `data` / raw array). */
export function unwrapChatwootList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const candidate = obj.payload ?? obj.data;
    if (Array.isArray(candidate)) return candidate as T[];
  }
  return [];
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

  async getAgentBot(
    accountId: string,
    botId: string,
  ): Promise<ChatwootResult<ChatwootAgentBot>> {
    return chatwootFetch<ChatwootAgentBot>(
      this.apiUrl,
      `/api/v1/accounts/${accountId}/agent_bots/${botId}`,
      this.apiToken,
    );
  }

  async createAgentBot(
    accountId: string,
    params: { name: string; outgoingUrl: string; description?: string },
  ): Promise<ChatwootResult<ChatwootAgentBot>> {
    return chatwootFetch<ChatwootAgentBot>(
      this.apiUrl,
      `/api/v1/accounts/${accountId}/agent_bots`,
      this.apiToken,
      {
        method: "POST",
        body: {
          name: params.name,
          outgoing_url: params.outgoingUrl,
          bot_type: 0,
          ...(params.description ? { description: params.description } : {}),
        },
      },
    );
  }

  async updateAgentBot(
    accountId: string,
    botId: string,
    params: { outgoingUrl: string; name?: string },
  ): Promise<ChatwootResult<ChatwootAgentBot>> {
    return chatwootFetch<ChatwootAgentBot>(
      this.apiUrl,
      `/api/v1/accounts/${accountId}/agent_bots/${botId}`,
      this.apiToken,
      {
        method: "PATCH",
        body: {
          outgoing_url: params.outgoingUrl,
          ...(params.name ? { name: params.name } : {}),
        },
      },
    );
  }

  /** Regenerates bot token (Chatwoot Cloud often omits it on GET/PATCH). */
  async resetAgentBotAccessToken(
    accountId: string,
    botId: string,
  ): Promise<ChatwootResult<ChatwootAgentBot>> {
    return chatwootFetch<ChatwootAgentBot>(
      this.apiUrl,
      `/api/v1/accounts/${accountId}/agent_bots/${botId}/reset_access_token`,
      this.apiToken,
      { method: "POST" },
    );
  }

  async listInboxes(accountId: string): Promise<ChatwootResult<ChatwootInboxSummary[]>> {
    const result = await chatwootFetch<unknown>(
      this.apiUrl,
      `/api/v1/accounts/${accountId}/inboxes`,
      this.apiToken,
    );
    if (!result.ok) return result;

    const items = unwrapChatwootList<{ id: number; name: string }>(result.data);
    return {
      ok: true,
      data: items.map((i) => ({ id: i.id, name: i.name ?? `Inbox ${i.id}` })),
    };
  }

  async setInboxAgentBot(
    accountId: string,
    inboxId: number,
    agentBotId: number,
  ): Promise<ChatwootResult<void>> {
    const url = `${this.apiUrl.replace(/\/$/, "")}/api/v1/accounts/${accountId}/inboxes/${inboxId}/set_agent_bot`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          api_access_token: this.apiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agent_bot: agentBotId }),
      });

      if (res.status === 204 || res.ok) {
        return { ok: true, data: undefined };
      }

      const json = await res.json().catch(() => ({}));
      const errMsg =
        (json as { error?: string; message?: string })?.error ??
        (json as { message?: string })?.message ??
        JSON.stringify(json);
      logger.error("Chatwoot set_agent_bot error", {
        accountId,
        inboxId,
        status: res.status,
        error: errMsg,
      });
      return { ok: false, status: res.status, error: errMsg };
    } catch (err) {
      return { ok: false, status: 0, error: String(err) };
    }
  }

  async updateConversationStatus(
    accountId: string,
    conversationId: number,
    status: ChatwootConversationStatus,
  ): Promise<ChatwootResult<{ id: number; status: string }>> {
    return chatwootFetch<{ id: number; status: string }>(
      this.apiUrl,
      `/api/v1/accounts/${accountId}/conversations/${conversationId}`,
      this.apiToken,
      {
        method: "PATCH",
        body: { status },
      },
    );
  }

  /** Preferred API for pending/open — PATCH alone may not update status on Chatwoot Cloud. */
  async toggleConversationStatus(
    accountId: string,
    conversationId: number,
    status: ChatwootConversationStatus,
  ): Promise<ChatwootResult<{ current_status?: string; success?: boolean }>> {
    return chatwootFetch<{ current_status?: string; success?: boolean }>(
      this.apiUrl,
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/toggle_status`,
      this.apiToken,
      {
        method: "POST",
        body: { status },
      },
    );
  }

  async unassignConversation(
    accountId: string,
    conversationId: number,
  ): Promise<ChatwootResult<unknown>> {
    return chatwootFetch<unknown>(
      this.apiUrl,
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/assignments`,
      this.apiToken,
      {
        method: "POST",
        body: { assignee_id: null },
      },
    );
  }

  async sendMessage(
    accountId: string,
    conversationId: number,
    content: string,
    options?: { agentBotId?: number },
  ): Promise<ChatwootResult<ChatwootMessageResponse>> {
    const body: Record<string, unknown> = {
      content,
      message_type: "outgoing",
      private: false,
    };
    if (options?.agentBotId != null) {
      body.sender_type = "AgentBot";
      body.sender_id = options.agentBotId;
    }
    return chatwootFetch<ChatwootMessageResponse>(
      this.apiUrl,
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      this.apiToken,
      {
        method: "POST",
        body,
      },
    );
  }

  async sendMessageWithAttachment(
    accountId: string,
    conversationId: number,
    content: string,
    attachmentUrl: string,
    filename?: string,
  ): Promise<ChatwootResult<ChatwootMessageResponse>> {
    const url = `${this.apiUrl.replace(/\/$/, "")}/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`;

    try {
      logger.info("Starting attachment send", { attachmentUrl, accountId, conversationId: String(conversationId) });

      const imageRes = await fetch(attachmentUrl);
      if (!imageRes.ok) {
        logger.error("Failed to fetch attachment", { attachmentUrl, status: imageRes.status });
        return { ok: false, status: imageRes.status, error: `Failed to fetch attachment: ${imageRes.status}` };
      }

      const blob = await imageRes.blob();
      const resolvedFilename = filename ?? attachmentUrl.split("/").pop()?.split("?")[0] ?? "image.jpg";

      logger.info("Attachment fetched", { url: attachmentUrl, filename: resolvedFilename, blobSize: blob.size, blobType: blob.type });

      const formData = new FormData();
      formData.append("attachments[]", blob, resolvedFilename);
      formData.append("message_type", "outgoing");
      formData.append("private", "false");
      if (content) {
        formData.append("content", content);
      }

      logger.info("FormData created, sending to Chatwoot", { url });

      const res = await fetch(url, {
        method: "POST",
        headers: { api_access_token: this.apiToken },
        body: formData,
      });

      logger.info("Chatwoot response received", { status: res.status, statusText: res.statusText });

      const json = await res.json();

      if (!res.ok) {
        const errMsg = json?.error ?? json?.message ?? JSON.stringify(json);
        logger.error("Chatwoot attachment API error", { url, status: res.status, error: errMsg, response: JSON.stringify(json) });
        return { ok: false, status: res.status, error: errMsg };
      }

      logger.info("Attachment sent successfully", { messageId: json.id });
      return { ok: true, data: json as ChatwootMessageResponse };
    } catch (err) {
      const errStr = err instanceof Error ? err.message : String(err);
      logger.error("Chatwoot attachment error", { url, error: errStr, stack: err instanceof Error ? err.stack : undefined });
      return { ok: false, status: 0, error: errStr };
    }
  }
}
