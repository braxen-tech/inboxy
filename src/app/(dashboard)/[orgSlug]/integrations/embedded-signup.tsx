"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  orgSlug: string;
  variant: "whatsapp" | "instagram";
  disabled?: boolean;
}

interface FBSdk {
  init(cfg: Record<string, unknown>): void;
  login(cb: (r: FBLoginResponse) => void, opts: Record<string, unknown>): void;
}

interface FBLoginResponse {
  authResponse?: { code?: string; accessToken?: string };
  status?: string;
}

declare global {
  interface Window {
    FB?: FBSdk;
    fbAsyncInit?: () => void;
  }
}

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID;

/**
 * Meta Embedded Signup v4 button.
 *
 * Flow:
 * 1. Load the Facebook JS SDK once.
 * 2. FB.login with the org's Configuration ID.
 * 3. Meta posts a `WA_EMBEDDED_SIGNUP` message with waba_id / phone_number_id / ig_user_id.
 * 4. On success we send the short-lived `code` (from authResponse) to the server, which
 *    exchanges it for a long-lived token and persists the channel.
 *
 * Important: FB.login rejects async callbacks ("Expression is of type asyncfunction").
 * Always wrap async work in a sync callback + void IIFE.
 */
export function EmbeddedSignupButton({ orgSlug, variant, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const pendingRef = useRef<{ wabaId?: string; phoneNumberId?: string; igUserId?: string } | null>(
    null,
  );

  useEffect(() => {
    if (!APP_ID) return;

    function markReady() {
      if (window.FB) setSdkReady(true);
    }

    if (window.FB) {
      markReady();
      return;
    }

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: APP_ID,
        cookie: true,
        xfbml: false,
        version: "v22.0",
      });
      markReady();
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-inboxy-fb-sdk="1"]');
    if (existing) {
      const tick = window.setInterval(() => {
        if (window.FB) {
          window.clearInterval(tick);
          markReady();
        }
      }, 200);
      return () => window.clearInterval(tick);
    }

    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.dataset.inboxyFbSdk = "1";
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (typeof event.data !== "string") return;
      try {
        const data = JSON.parse(event.data);
        if (data.type !== "WA_EMBEDDED_SIGNUP") return;
        if (data.event === "FINISH" || data.event === "FINISH_ONLY_WABA") {
          pendingRef.current = {
            wabaId: data.data?.waba_id,
            phoneNumberId: data.data?.phone_number_id,
            igUserId: data.data?.ig_user_id ?? data.data?.page_id,
          };
        }
      } catch {
        /* ignore non-JSON messages */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const finishExchange = useCallback(
    async (code: string) => {
      const meta = pendingRef.current ?? {};
      const res = await fetch("/api/meta/embedded-signup/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orgSlug,
          type: variant,
          code,
          wabaId: meta.wabaId ?? null,
          igUserId: meta.igUserId ?? null,
        }),
      });

      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Falha ao concluir conexão.");
        setBusy(false);
        return;
      }

      window.location.reload();
    },
    [orgSlug, variant],
  );

  const launch = useCallback(() => {
    setError(null);
    if (!window.FB || !CONFIG_ID || !sdkReady) {
      setError("SDK do Meta ainda carregando. Aguarde alguns segundos e tente novamente.");
      return;
    }

    setBusy(true);
    pendingRef.current = null;

    // Must be a sync function — Meta SDK rejects AsyncFunction.
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          const detail =
            response.status === "unknown"
              ? "Popup bloqueado ou configuração inválida no Meta App (Site URL / App Domains / Configuration ID)."
              : "Fluxo cancelado ou permissão negada.";
          setError(detail);
          setBusy(false);
          return;
        }
        void finishExchange(code).catch((err) => {
          setError(err instanceof Error ? err.message : "Falha ao conectar.");
          setBusy(false);
        });
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "",
          sessionInfoVersion: "3",
        },
      },
    );
  }, [finishExchange, sdkReady]);

  if (!APP_ID || !CONFIG_ID) {
    return (
      <Button size="sm" disabled title="Configure NEXT_PUBLIC_META_APP_ID e CONFIG_ID">
        Conectar
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={launch} disabled={busy || disabled || !sdkReady}>
        {busy ? "Conectando..." : !sdkReady ? "Carregando…" : "Conectar"}
      </Button>
      {error && <span className="text-xs text-destructive max-w-[240px] text-right">{error}</span>}
    </div>
  );
}
