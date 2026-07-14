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
/** Prefer per-channel config; fall back to the generic Embedded Signup config. */
const WHATSAPP_CONFIG_ID =
  process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID ??
  process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID;
const INSTAGRAM_CONFIG_ID =
  process.env.NEXT_PUBLIC_META_INSTAGRAM_CONFIG_ID ??
  process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID;

function configIdFor(variant: "whatsapp" | "instagram"): string | undefined {
  return variant === "whatsapp" ? WHATSAPP_CONFIG_ID : INSTAGRAM_CONFIG_ID;
}

/** Shared across all EmbeddedSignupButton instances — avoids fbAsyncInit race. */
let fbSdkPromise: Promise<FBSdk> | null = null;

function loadFbSdk(): Promise<FBSdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("FB SDK só roda no browser."));
  }
  if (window.FB) return Promise.resolve(window.FB);
  if (fbSdkPromise) return fbSdkPromise;
  if (!APP_ID) return Promise.reject(new Error("NEXT_PUBLIC_META_APP_ID ausente."));

  fbSdkPromise = new Promise<FBSdk>((resolve, reject) => {
    let settled = false;
    const done = (fb: FBSdk) => {
      if (settled) return;
      settled = true;
      resolve(fb);
    };
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      fbSdkPromise = null;
      reject(err);
    };

    const prevInit = window.fbAsyncInit;
    window.fbAsyncInit = () => {
      try {
        prevInit?.();
        window.FB?.init({
          appId: APP_ID,
          cookie: true,
          xfbml: false,
          version: "v22.0",
        });
        if (!window.FB) {
          fail(new Error("FB SDK carregou sem expor window.FB"));
          return;
        }
        done(window.FB);
      } catch (err) {
        fail(err);
      }
    };

    if (!document.querySelector('script[data-inboxy-fb-sdk="1"]')) {
      const script = document.createElement("script");
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.dataset.inboxyFbSdk = "1";
      script.onerror = () => fail(new Error("Falha ao carregar Facebook SDK."));
      document.body.appendChild(script);
    }

    const started = Date.now();
    const tick = window.setInterval(() => {
      if (window.FB) {
        window.clearInterval(tick);
        try {
          window.FB.init({
            appId: APP_ID,
            cookie: true,
            xfbml: false,
            version: "v22.0",
          });
          done(window.FB);
        } catch (err) {
          fail(err);
        }
      } else if (Date.now() - started > 15_000) {
        window.clearInterval(tick);
        fail(new Error("Timeout carregando Facebook SDK."));
      }
    }, 200);
  });

  return fbSdkPromise;
}

/**
 * Meta Embedded Signup v4 button.
 *
 * Important: FB.login rejects async callbacks ("Expression is of type asyncfunction").
 * Always wrap async work in a sync callback + void promise.
 */
export function EmbeddedSignupButton({ orgSlug, variant, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<{ wabaId?: string; phoneNumberId?: string; igUserId?: string } | null>(
    null,
  );

  // Warm the SDK in background (shared singleton for all buttons on the page).
  useEffect(() => {
    if (!APP_ID) return;
    void loadFbSdk().catch(() => {
      /* surfaced on click */
    });
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
    const CONFIG_ID = configIdFor(variant);
    if (!CONFIG_ID) {
      setError("Configuration ID do Meta não configurado.");
      return;
    }

    setBusy(true);
    pendingRef.current = null;

    void loadFbSdk()
      .then((FB) => {
        // Must be a sync function — Meta SDK rejects AsyncFunction.
        FB.login(
          (response) => {
            const code = response.authResponse?.code;
            if (!code) {
              const detail =
                response.status === "unknown"
                  ? "Popup bloqueado ou configuração inválida no Meta App (Site URL precisa ser https://, App Domains, Configuration ID)."
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
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Falha ao carregar Facebook SDK.");
        setBusy(false);
      });
  }, [finishExchange, variant]);

  const CONFIG_ID = configIdFor(variant);

  if (!APP_ID || !CONFIG_ID) {
    return (
      <Button size="sm" disabled title="Configure NEXT_PUBLIC_META_APP_ID e CONFIG_ID">
        Conectar
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={launch} disabled={busy || disabled}>
        {busy ? "Conectando..." : "Conectar"}
      </Button>
      {error && <span className="text-xs text-destructive max-w-[240px] text-right">{error}</span>}
    </div>
  );
}
