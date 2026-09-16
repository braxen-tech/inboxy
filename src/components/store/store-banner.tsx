"use client";

import { useState, useTransition, useEffect } from "react";
import { X } from "lucide-react";
import { createDigitalProductCheckout, createCourseCheckout } from "@/app/(store)/s/[slug]/actions";

interface StoreBannerData {
  id: string;
  text: string;
  link_url: string | null;
  link_product_id: string | null;
  link_course_id: string | null;
  link_label: string | null;
}

interface StoreBannerProps {
  banner: StoreBannerData;
  orgSlug: string;
  discountPromoCodeId?: string;
}

export function StoreBanner({ banner, orgSlug, discountPromoCodeId }: StoreBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(`banner:${banner.id}:dismissed`) === "1") {
        setDismissed(true);
        return;
      }
    } catch {
      // localStorage unavailable
    }
    try { window.posthog?.capture("store_banner_view", { banner_id: banner.id, org_slug: orgSlug }); } catch {}
  }, [banner.id, orgSlug]);

  if (dismissed) return null;

  function dismiss() {
    try { localStorage.setItem(`banner:${banner.id}:dismissed`, "1"); } catch {}
    try { window.posthog?.capture("store_banner_dismissed", { banner_id: banner.id, org_slug: orgSlug }); } catch {}
    setDismissed(true);
  }

  function handleLinkClick() {
    setCheckoutError(null);
    try { window.posthog?.capture("store_banner_click", { banner_id: banner.id, org_slug: orgSlug }); } catch {}
    if (banner.link_product_id) {
      startTransition(async () => {
        const result = await createDigitalProductCheckout(orgSlug, banner.link_product_id!, discountPromoCodeId);
        if ("url" in result && result.url) { window.location.href = result.url; return; }
        if ("error" in result) setCheckoutError(result.error ?? "Erro ao gerar link.");
      });
    } else if (banner.link_course_id) {
      startTransition(async () => {
        const result = await createCourseCheckout(orgSlug, banner.link_course_id!, discountPromoCodeId);
        if ("url" in result && result.url) { window.location.href = result.url; return; }
        if ("error" in result) setCheckoutError(result.error ?? "Erro ao gerar link.");
      });
    }
  }

  const hasInternalLink = !!(banner.link_product_id || banner.link_course_id);
  const hasExternalLink = !!banner.link_url;
  const hasLink = hasInternalLink || hasExternalLink;
  const linkLabel = banner.link_label || "Ver mais";

  const bannerClickable = hasLink && !hasExternalLink;

  return (
    <div
      className="sticky top-0 z-50 relative flex items-center justify-center gap-3 px-10 py-2.5 text-sm font-medium"
      style={{ backgroundColor: "var(--store-primary)", color: "var(--store-bg)" }}
    >
      <span
        className={`text-center leading-snug${bannerClickable ? " cursor-pointer" : ""}`}
        onClick={bannerClickable ? handleLinkClick : undefined}
      >
        {banner.text}
      </span>

      {hasLink && (
        hasExternalLink ? (
          <a
            href={banner.link_url!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { try { window.posthog?.capture("store_banner_click", { banner_id: banner.id, org_slug: orgSlug }); } catch {} }}
            className="shrink-0 rounded-full border px-3 py-0.5 text-xs font-semibold opacity-90 hover:opacity-100 transition-opacity"
            style={{ borderColor: "var(--store-bg)", color: "var(--store-bg)" }}
          >
            {linkLabel}
          </a>
        ) : (
          <button
            type="button"
            onClick={handleLinkClick}
            disabled={pending}
            className="shrink-0 rounded-full border px-3 py-0.5 text-xs font-semibold opacity-90 hover:opacity-100 transition-opacity disabled:opacity-60"
            style={{ borderColor: "var(--store-bg)", color: "var(--store-bg)" }}
          >
            {pending ? "..." : linkLabel}
          </button>
        )
      )}

      <button
        type="button"
        aria-label="Fechar banner"
        onClick={dismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 opacity-70 hover:opacity-100 transition-opacity"
        style={{ color: "var(--store-bg)" }}
      >
        <X className="size-3.5" />
      </button>

      {checkoutError && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full mt-1 rounded bg-destructive px-2 py-0.5 text-xs text-white z-10">
          {checkoutError}
        </span>
      )}
    </div>
  );
}
