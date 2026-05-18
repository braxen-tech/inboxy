const CAL_BASE_URL = process.env.CAL_COM_API_BASE_URL ?? "https://api.cal.com";

interface CalClientOptions {
  apiToken: string;
}

interface CalRequestOptions {
  method: "GET" | "POST";
  path: string;
  apiVersion: string;
  body?: unknown;
  params?: Record<string, string>;
}

export interface CalSlotsResponse {
  status: string;
  data: Record<string, { time: string }[]> | Record<string, string[]>;
}

export interface CalBookingResponse {
  status: string;
  data: {
    id: number;
    uid: string;
    start: string;
    end: string;
    eventTypeId: number;
    attendees: { name: string; email: string }[];
  };
}

export class CalComClient {
  private apiToken: string;

  constructor(options: CalClientOptions) {
    this.apiToken = options.apiToken;
  }

  async request<T>(options: CalRequestOptions): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
    const url = new URL(`${CAL_BASE_URL}${options.path}`);
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url.searchParams.set(key, value);
      }
    }

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${this.apiToken}`,
      "cal-api-version": options.apiVersion,
      "Content-Type": "application/json",
    };

    const response = await fetch(url.toString(), {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, status: response.status, message: text || response.statusText };
    }

    const data = (await response.json()) as T;
    return { ok: true, data };
  }
}
