"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteDigitalProduct } from "./actions";
import { Trash2 } from "lucide-react";

interface Props {
  orgSlug: string;
  productId: string;
}

export function DeleteProductButton({ orgSlug, productId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      await deleteDigitalProduct(orgSlug, productId);
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={confirming ? "destructive" : "ghost"}
      size="sm"
      disabled={pending}
      onClick={handleClick}
      onBlur={() => setConfirming(false)}
      className="shrink-0"
    >
      {confirming ? (pending ? "..." : "Confirmar") : <Trash2 className="size-4" />}
    </Button>
  );
}
