"use client";

import { useState, useTransition } from "react";
import { Clock, ExternalLink } from "lucide-react";
import { createDirectCheckout, createDigitalProductCheckout } from "@/app/(store)/s/[slug]/actions";

interface StoreBlock {
  id: string;
  type: "product" | "booking" | "link";
  title: string | null;
  description: string | null;
  image_url: string | null;
  cta_text: string;
  external_url: string | null;
  price_display: string | null;
  price_brl: number | null;
  payment_type: string | null;
  billing_cycle: string | null;
  duration_minutes: number | null;
  link_icon: string | null;
  digital_product_id: string | null;
}

interface StoreBlockCardProps {
  block: StoreBlock;
  cardLayout: "horizontal" | "vertical";
  orgSlug: string;
  onBlockClick?: (blockId: string, blockType: string, blockTitle: string | null) => void;
}

function LinkCard({ block, onBlockClick }: { block: StoreBlock; onBlockClick?: StoreBlockCardProps["onBlockClick"] }) {
  return (
    <a
      href={block.external_url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onBlockClick?.(block.id, block.type, block.title)}
      className="flex items-center gap-3 rounded-[var(--store-radius)] p-4 transition-transform hover:scale-[1.02]"
      style={{ backgroundColor: "var(--store-card)" }}
    >
      <ExternalLink className="size-5 shrink-0" style={{ color: "var(--store-primary)" }} />
      <span className="flex-1 text-sm font-medium" style={{ color: "var(--store-text)" }}>
        {block.title}
      </span>
      <ExternalLink className="size-4 shrink-0 opacity-40" style={{ color: "var(--store-text)" }} />
    </a>
  );
}

function ProductOrBookingCard({
  block,
  cardLayout,
  orgSlug,
  onBlockClick,
}: {
  block: StoreBlock;
  cardLayout: "horizontal" | "vertical";
  orgSlug: string;
  onBlockClick?: StoreBlockCardProps["onBlockClick"];
}) {
  const isHorizontal = cardLayout === "horizontal";
  const isPurchasable = block.type === "product" && !!block.price_brl && block.price_brl > 0;
  const isDigital = !!block.digital_product_id;
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function runCheckout(buyerEmail?: string, buyerName?: string) {
    onBlockClick?.(block.id, block.type, block.title);
    setError(null);
    startTransition(async () => {
      const result =
        isDigital && buyerEmail
          ? await createDigitalProductCheckout(orgSlug, block.digital_product_id!, { buyerEmail, buyerName })
          : await createDirectCheckout(orgSlug, block.id);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("url" in result && result.url) {
        window.location.href = result.url;
      }
    });
  }

  function handleBuyClick() {
    if (isDigital) {
      setShowEmailForm(true);
      return;
    }
    runCheckout();
  }

  function submitEmailForm(e: React.FormEvent) {
    e.preventDefault();
    runCheckout(email, name || undefined);
  }

  return (
    <div
      className={`overflow-hidden rounded-[var(--store-radius)] transition-transform hover:scale-[1.02] ${
        isHorizontal ? "flex" : "flex flex-col"
      }`}
      style={{ backgroundColor: "var(--store-card)" }}
    >
      {block.image_url && (
        <div className={isHorizontal ? "w-32 shrink-0 sm:w-40" : "w-full"}>
          <img
            src={block.image_url}
            alt={block.title ?? ""}
            className={`object-cover ${isHorizontal ? "h-full w-full" : "h-48 w-full"}`}
          />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        {block.title && (
          <h3 className="font-semibold leading-tight" style={{ color: "var(--store-text)" }}>
            {block.title}
          </h3>
        )}

        {block.description && (
          <p className="text-sm leading-relaxed opacity-70 line-clamp-2" style={{ color: "var(--store-text)" }}>
            {block.description}
          </p>
        )}

        <div className="mt-auto flex items-center gap-2 pt-2">
          {block.type === "product" && block.price_display && (
            <span className="text-sm font-bold" style={{ color: "var(--store-primary)" }}>
              {block.price_display}
            </span>
          )}
          {block.type === "booking" && block.duration_minutes && (
            <span className="flex items-center gap-1 text-xs opacity-60" style={{ color: "var(--store-text)" }}>
              <Clock className="size-3" />
              {block.duration_minutes} min
            </span>
          )}
        </div>

        {isPurchasable ? (
          showEmailForm ? (
            <form onSubmit={submitEmailForm} className="mt-2 space-y-2">
              <p className="text-xs opacity-60" style={{ color: "var(--store-text)" }}>
                Após o pagamento, enviaremos o acesso para este e-mail.
              </p>
              <input
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                style={{ color: "var(--store-text)" }}
              />
              <input
                type="email"
                placeholder="Seu e-mail"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                style={{ color: "var(--store-text)" }}
              />
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-[var(--store-radius)] px-4 py-2.5 text-center text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: "var(--store-primary)", color: "var(--store-bg)" }}
              >
                {pending ? "Gerando link..." : "Continuar para pagamento"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={handleBuyClick}
              className="mt-2 block rounded-[var(--store-radius)] px-4 py-2.5 text-center text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{
                backgroundColor: "var(--store-primary)",
                color: "var(--store-bg)",
              }}
            >
              {pending ? "Gerando link..." : block.cta_text}
            </button>
          )
        ) : (
          block.external_url && (
            <a
              href={block.external_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onBlockClick?.(block.id, block.type, block.title)}
              className="mt-2 block rounded-[var(--store-radius)] px-4 py-2.5 text-center text-sm font-semibold transition-opacity hover:opacity-90"
              style={{
                backgroundColor: "var(--store-primary)",
                color: "var(--store-bg)",
              }}
            >
              {block.cta_text}
            </a>
          )
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}

export function StoreBlockCard({ block, cardLayout, orgSlug, onBlockClick }: StoreBlockCardProps) {
  if (block.type === "link") {
    return <LinkCard block={block} onBlockClick={onBlockClick} />;
  }
  return <ProductOrBookingCard block={block} cardLayout={cardLayout} orgSlug={orgSlug} onBlockClick={onBlockClick} />;
}
