"use client";

import Script from "next/script";

const CHATWOOT_BASE_URL =
  process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL ?? "https://app.chatwoot.com";
const CHATWOOT_WEBSITE_TOKEN =
  process.env.NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN ?? "SjX6XmQZZDir34mA81fP4y8j";

declare global {
  interface Window {
    chatwootSettings?: {
      position: string;
      type: string;
      launcherTitle: string;
    };
    chatwootSDK?: {
      run: (config: { websiteToken: string; baseUrl: string }) => void;
    };
  }
}

export function ChatwootWidget() {
  return (
    <>
      <Script id="chatwoot-settings" strategy="afterInteractive">
        {`window.chatwootSettings = {"position":"right","type":"expanded_bubble","launcherTitle":"Converse conosco"};`}
      </Script>
      <Script
        id="chatwoot-sdk"
        src={`${CHATWOOT_BASE_URL}/packs/js/sdk.js`}
        strategy="afterInteractive"
        onLoad={() => {
          window.chatwootSDK?.run({
            websiteToken: CHATWOOT_WEBSITE_TOKEN,
            baseUrl: CHATWOOT_BASE_URL,
          });
        }}
      />
    </>
  );
}
