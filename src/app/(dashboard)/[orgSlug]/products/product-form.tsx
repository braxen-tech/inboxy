"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDigitalProduct } from "./actions";

interface Props {
  orgSlug: string;
  onSuccess?: () => void;
}

export function ProductForm({ orgSlug, onSuccess }: Props) {
  const router = useRouter();
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    formData.set("orgSlug", orgSlug);

    startTransition(async () => {
      const r = await createDigitalProduct(formData);
      if ("error" in r && r.error) {
        setMessage({ type: "err", text: r.error });
      } else {
        setMessage({ type: "ok", text: t("createSuccess") });
        formRef.current?.reset();
        router.refresh();
        onSuccess?.();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">{tc("title")}</Label>
        <Input id="title" name="title" required placeholder="E-book de Marketing Digital" maxLength={200} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea id="description" name="description" placeholder="Breve descrição do produto..." rows={3} maxLength={2000} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">{t("file")}</Label>
        <Input id="file" name="file" type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.jpg,.jpeg,.png,.mp3,.mp4" />
        <p className="text-xs text-muted-foreground">{t("fileHint")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priceBrl">{t("price")}</Label>
          <Input id="priceBrl" name="priceBrl" type="number" min="0" step="0.01" required placeholder="49.90" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="paymentType">{t("paymentType")}</Label>
          <select id="paymentType" name="paymentType" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="one_time">{t("oneTime")}</option>
            <option value="recurring">{t("recurring")}</option>
          </select>
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? tc("sending") : tc("create")}
      </Button>

      {message && (
        <p className={message.type === "ok" ? "text-sm text-green-600 dark:text-green-400" : "text-sm text-destructive"}>
          {message.text}
        </p>
      )}
    </form>
  );
}
