"use client";

import { useEffect, useRef } from "react";

interface StoreChatWidgetProps {
  chatwootApiUrl: string;
  websiteToken: string;
  trigger: "none" | "timer" | "scroll" | "exit_intent";
  triggerSeconds: number;
  greeting: string | null;
  orgId: string;
  orgSlug: string;
}

declare global {
  interface Window {
    chatwootSettings?: Record<string, unknown>;
    chatwootSDK?: { run: (config: Record<string, unknown>) => void };
    $chatwoot?: {
      toggle: (state: "open" | "close") => void;
      setCustomAttributes: (attrs: Record<string, unknown>) => void;
    };
  }
}

export function StoreChatWidget({
  chatwootApiUrl,
  websiteToken,
  trigger,
  triggerSeconds,
  greeting,
  orgId,
  orgSlug,
}: StoreChatWidgetProps) {
  const triggered = useRef(false);
  const sdkLoaded = useRef(false);

  useEffect(() => {
    if (sdkLoaded.current) return;
    sdkLoaded.current = true;

    const baseUrl = chatwootApiUrl.replace(/\/$/, "");

    window.chatwootSettings = {
      hideMessageBubble: trigger !== "none",
      position: "right",
      locale: "pt_BR",
      type: "standard",
    };

    const script = document.createElement("script");
    script.src = `${baseUrl}/packs/js/sdk.js`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.chatwootSDK) {
        window.chatwootSDK.run({
          websiteToken,
          baseUrl,
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [chatwootApiUrl, websiteToken, trigger]);

  useEffect(() => {
    function openChat() {
      if (triggered.current) return;
      triggered.current = true;

      try {
        if (window.posthog) {
          window.posthog.capture("store_chat_opened", {
            org_id: orgId,
            org_slug: orgSlug,
            trigger_type: trigger,
          });
        }
      } catch {
        // analytics should never break the chat
      }

      const tryOpen = () => {
        if (window.$chatwoot) {
          window.$chatwoot.toggle("open");
          if (greeting) {
            window.$chatwoot.setCustomAttributes({ greeting });
          }
        } else {
          setTimeout(tryOpen, 500);
        }
      };
      tryOpen();
    }

    if (trigger === "none") return;

    if (trigger === "timer") {
      const timer = setTimeout(openChat, triggerSeconds * 1000);
      return () => clearTimeout(timer);
    }

    if (trigger === "scroll") {
      const sentinel = document.createElement("div");
      sentinel.style.position = "absolute";
      sentinel.style.top = "60%";
      sentinel.style.height = "1px";
      sentinel.style.width = "1px";
      sentinel.style.pointerEvents = "none";
      document.body.appendChild(sentinel);

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            openChat();
            observer.disconnect();
          }
        },
        { threshold: 0 },
      );
      observer.observe(sentinel);

      return () => {
        observer.disconnect();
        sentinel.remove();
      };
    }

    if (trigger === "exit_intent") {
      function handleMouseOut(e: MouseEvent) {
        if (e.clientY <= 0) {
          openChat();
          document.removeEventListener("mouseout", handleMouseOut);
        }
      }
      document.addEventListener("mouseout", handleMouseOut);
      return () => document.removeEventListener("mouseout", handleMouseOut);
    }
  }, [trigger, triggerSeconds, greeting, orgId, orgSlug]);

  return null;
}
