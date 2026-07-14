/**
 * Meta Graph API version pinned for the app.
 * Bump this deliberately when validating against a new version.
 */
export const META_GRAPH_VERSION = "v21.0";
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export interface GraphError {
  status: number;
  message: string;
  code?: number;
  subcode?: number;
}

export async function graphPost<T = unknown>(
  path: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: GraphError }> {
  const res = await fetch(`${META_GRAPH_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    // keep raw text below
  }

  if (!res.ok) {
    const err = (parsed as { error?: { message?: string; code?: number; error_subcode?: number } } | null)?.error;
    return {
      ok: false,
      error: {
        status: res.status,
        message: err?.message ?? raw ?? `HTTP ${res.status}`,
        code: err?.code,
        subcode: err?.error_subcode,
      },
    };
  }

  return { ok: true, data: parsed as T };
}

export async function graphGet<T = unknown>(
  path: string,
  accessToken: string,
): Promise<{ ok: true; data: T } | { ok: false; error: GraphError }> {
  const res = await fetch(`${META_GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const raw = await res.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const err = (parsed as { error?: { message?: string; code?: number } } | null)?.error;
    return {
      ok: false,
      error: {
        status: res.status,
        message: err?.message ?? raw ?? `HTTP ${res.status}`,
        code: err?.code,
      },
    };
  }

  return { ok: true, data: parsed as T };
}
