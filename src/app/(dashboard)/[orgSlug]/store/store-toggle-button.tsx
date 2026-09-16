"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toggleStoreEnabled } from "./actions";

export function StoreToggleButton({
  orgSlug,
  initialEnabled,
}: {
  orgSlug: string;
  initialEnabled: boolean;
}) {
  const t = useTranslations("store");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const r = await toggleStoreEnabled(orgSlug, next);
      if (r.error) setEnabled(!next);
    });
  }

  return (
    <Button variant={enabled ? "default" : "outline"} size="sm" onClick={handleToggle} disabled={pending}>
      {enabled ? t("active") : t("activate")}
    </Button>
  );
}
