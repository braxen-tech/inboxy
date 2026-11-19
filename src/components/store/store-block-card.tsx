"use client";

import { useState, useTransition } from "react";
import { createDirectCheckout, createDigitalProductCheckout, createCourseCheckout } from "@/app/(store)/s/[slug]/actions";

export interface StoreBlock {
  id: string;
  type: "product" | "booking" | "link" | "course";
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
  course_id: string | null;
}

export type BlockClickHandler = (blockId: string, blockType: string, blockTitle: string | null) => void;

/* ---------- Helpers ---------- */

export type BlockKind = "course" | "digital" | "subscription" | "booking" | "product";

export const KIND_LABEL: Record<BlockKind, string> = {
  course: "Curso",
  digital: "Produto digital",
  subscription: "Assinatura",
  booking: "Agendamento",
  product: "Produto",
};

export const KIND_FILTER_LABEL: Record<BlockKind, string> = {
  course: "Cursos",
  digital: "Produtos digitais",
  subscription: "Assinaturas",
  booking: "Agendamentos",
  product: "Outros",
};

export function blockKind(block: StoreBlock): BlockKind {
  if (block.type === "course") return "course";
  if (block.type === "booking") return "booking";
  if (block.payment_type === "recurring") return "subscription";
  if (block.digital_product_id) return "digital";
  return "product";
}

function kindDetail(block: StoreBlock, kind: BlockKind): string {
  switch (kind) {
    case "course": return "Acesso imediato";
    case "digital": return "Entrega imediata";
    case "subscription": return "Cancele quando quiser";
    case "booking": return block.duration_minutes ? `${block.duration_minutes} min` : "Escolha o horário";
    default: return "";
  }
}

export function eyebrow(block: StoreBlock): string {
  const kind = blockKind(block);
  const detail = kindDetail(block, kind);
  return detail ? `${KIND_LABEL[kind]} · ${detail}` : KIND_LABEL[kind];
}

/** Generic CTAs are replaced by one that says what happens next; custom texts are kept. */
const GENERIC_CTAS = new Set(["comprar agora", "comprar", "saiba mais", "assinar agora", "ver mais"]);
export function ctaLabel(block: StoreBlock): string {
  const text = block.cta_text?.trim();
  if (text && !GENERIC_CTAS.has(text.toLowerCase())) return text;
  switch (blockKind(block)) {
    case "course": return "Quero o curso";
    case "subscription": return "Assinar";
    case "booking": return "Agendar";
    default: return "Comprar";
  }
}

export function recurringSuffix(block: StoreBlock): string | null {
  if (block.payment_type !== "recurring") return null;
  const cycle = (block.billing_cycle ?? "").toLowerCase();
  return cycle === "yearly" || cycle === "annual" || cycle === "year" ? "/ano" : "/mês";
}

export function isPurchasable(block: StoreBlock): boolean {
  return (block.type === "product" || block.type === "course") && !!block.price_brl && block.price_brl > 0;
}

/* ---------- Checkout ---------- */

export function useBlockCheckout(block: StoreBlock, orgSlug: string, discountPromoCodeId?: string, onBlockClick?: BlockClickHandler) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function buy() {
    onBlockClick?.(block.id, block.type, block.title);
    setError(null);
    startTransition(async () => {
      const result =
        block.type === "course" && block.course_id
          ? await createCourseCheckout(orgSlug, block.course_id, discountPromoCodeId)
          : block.digital_product_id
            ? await createDigitalProductCheckout(orgSlug, block.digital_product_id, discountPromoCodeId)
            : await createDirectCheckout(orgSlug, block.id);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("url" in result && result.url) window.location.href = result.url;
    });
  }

  return { buy, pending, error };
}

/* ---------- Pieces ---------- */

/** The creator's uploaded image, or a generated cover in the store colors. */
export function ProductCover({ block, variant, showKind = true, badge }: { block: StoreBlock; variant: number; showKind?: boolean; badge?: string }) {
  const glyph = (block.title ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="s-pcover">
      {badge && <span className="s-badge">{badge}</span>}
      {block.image_url ? (
        <img src={block.image_url} alt="" loading="lazy" />
      ) : (
        <div className={`s-gen v${variant % 3}`} aria-hidden="true">
          <div className="g-shape" />
          <div className="g-glyph">{glyph}</div>
        </div>
      )}
      {showKind && <span className="s-kind">{KIND_LABEL[blockKind(block)]}</span>}
    </div>
  );
}

function Price({ block, big = false }: { block: StoreBlock; big?: boolean }) {
  if (!block.price_display) return null;
  const suffix = recurringSuffix(block);
  return big ? (
    <div className="s-price">
      <b className="s-mono">{block.price_display}</b>
      {suffix && <small>{suffix}</small>}
    </div>
  ) : (
    <span className="s-p s-mono">
      {block.price_display} {suffix && <small>{suffix}</small>}
    </span>
  );
}

function Action({ block, orgSlug, discountPromoCodeId, onBlockClick, className }: {
  block: StoreBlock; orgSlug: string; discountPromoCodeId?: string; onBlockClick?: BlockClickHandler; className: string;
}) {
  const { buy, pending, error } = useBlockCheckout(block, orgSlug, discountPromoCodeId, onBlockClick);
  const label = ctaLabel(block);
  if (isPurchasable(block)) {
    return (
      <>
        <button type="button" className={className} disabled={pending} onClick={buy}>
          {pending ? "Aguarde..." : `${label} →`}
        </button>
        {error && <p className="s-err" role="alert">{error}</p>}
      </>
    );
  }
  if (block.external_url) {
    return (
      <a className={className} href={block.external_url} target="_blank" rel="noopener noreferrer" onClick={() => onBlockClick?.(block.id, block.type, block.title)}>
        {label} →
      </a>
    );
  }
  return null;
}

export function FeaturedProduct({ block, orgSlug, discountPromoCodeId, onBlockClick }: {
  block: StoreBlock; orgSlug: string; discountPromoCodeId?: string; onBlockClick?: BlockClickHandler;
}) {
  const hasAccess = blockKind(block) === "course" || blockKind(block) === "digital";
  return (
    <article className="s-feat" id="destaque">
      <ProductCover block={block} variant={0} badge="Destaque" />
      <div className="s-feat-b">
        <span className="s-eyebrow">{eyebrow(block)}</span>
        <h2 className="s-display">{block.title}</h2>
        {block.description && <p>{block.description}</p>}
        <Price block={block} big />
        <Action block={block} orgSlug={orgSlug} discountPromoCodeId={discountPromoCodeId} onBlockClick={onBlockClick} className="s-btn s-btn-primary s-btn-block" />
        <div className="s-trustline">
          <span>🔒 Pagamento seguro</span>
          {hasAccess && <span>⚡ Acesso imediato</span>}
        </div>
      </div>
    </article>
  );
}

export function ProductCard({ block, index, orgSlug, discountPromoCodeId, onBlockClick }: {
  block: StoreBlock; index: number; orgSlug: string; discountPromoCodeId?: string; onBlockClick?: BlockClickHandler;
}) {
  return (
    <article className="s-card">
      <ProductCover block={block} variant={index + 1} />
      <div className="s-card-b">
        <span className="s-eyebrow">{eyebrow(block)}</span>
        <h3 className="s-display">{block.title}</h3>
        {block.description && <p>{block.description}</p>}
        <div className="s-card-foot">
          <Price block={block} />
          <Action block={block} orgSlug={orgSlug} discountPromoCodeId={discountPromoCodeId} onBlockClick={onBlockClick} className="s-btn s-btn-primary" />
        </div>
      </div>
    </article>
  );
}

export function LinkRow({ block, onBlockClick }: { block: StoreBlock; onBlockClick?: BlockClickHandler }) {
  return (
    <a className="s-link" href={block.external_url ?? "#"} target="_blank" rel="noopener noreferrer" onClick={() => onBlockClick?.(block.id, block.type, block.title)}>
      <span className="ic" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
      </span>
      {block.title}
      <span className="arr" aria-hidden="true">↗</span>
    </a>
  );
}
