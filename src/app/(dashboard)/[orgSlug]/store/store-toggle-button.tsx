"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toggleStoreEnabled } from "./actions";

export function StoreToggleButton({
  orgSlug,
  initialEnabled,
}: {
  orgSlug: string;
  initialEnabled: boolean;
}) {
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
      {enabled ? "Ativa" : "Ativar loja"}
    </Button>
  );
}
