"use client";

import { useTransition } from "react";
import { updateDigitalProductPaymentType } from "./actions";

interface Props {
  orgSlug: string;
  productId: string;
  paymentType: "one_time" | "recurring";
}

export function PaymentTypeToggle({ orgSlug, productId, paymentType }: Props) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = paymentType === "one_time" ? "recurring" : "one_time";
    startTransition(async () => { await updateDigitalProductPaymentType(orgSlug, productId, next); });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
    >
      {paymentType === "one_time" ? "único" : "mensal"}
    </button>
  );
}
