"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

const LOCALE_NAMES: Record<string, string> = {
  pt: "PT",
  en: "EN",
};

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const [, startTransition] = useTransition();

  function cycleLocale() {
    const locales = routing.locales as readonly string[];
    const idx = locales.indexOf(locale);
    const next = locales[(idx + 1) % locales.length];
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      title={locale.toUpperCase()}
      onClick={cycleLocale}
      className="shrink-0 text-xs font-semibold"
    >
      {LOCALE_NAMES[locale] ?? locale.toUpperCase()}
    </Button>
  );
}
