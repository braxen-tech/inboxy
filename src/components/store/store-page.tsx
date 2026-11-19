"use client";

import { useEffect, useState } from "react";
import { StoreProfile } from "./store-profile";
import {
  FeaturedProduct,
  KIND_FILTER_LABEL,
  LinkRow,
  ProductCard,
  blockKind,
  ctaLabel,
  isPurchasable,
  recurringSuffix,
  useBlockCheckout,
  type BlockKind,
  type StoreBlock,
} from "./store-block-card";

interface SocialLink {
  platform: string;
  url: string;
}

interface StorePageProps {
  displayName: string;
  bio: string | null;
  photoUrl: string | null;
  coverImageUrl?: string | null;
  socialLinks: SocialLink[];
  blocks: StoreBlock[];
  orgId: string;
  orgSlug: string;
  discountPromoCodeId?: string;
}

export function StorePage({
  displayName,
  bio,
  photoUrl,
  coverImageUrl,
  socialLinks,
  blocks,
  orgId,
  orgSlug,
  discountPromoCodeId,
}: StorePageProps) {
  const offers = blocks.filter((b) => b.type !== "link");
  const linkBlocks = blocks.filter((b) => b.type === "link");
  // The first offer in the creator's order is the highlight.
  const [featured, ...rest] = offers;

  const kinds = Array.from(new Set(rest.map(blockKind)));
  const [filter, setFilter] = useState<BlockKind | "all">("all");
  const visible = filter === "all" ? rest : rest.filter((b) => blockKind(b) === filter);
  const showFilters = kinds.length > 1 && rest.length > 2;
  const anyInstant = offers.some((b) => ["course", "digital", "subscription"].includes(blockKind(b)));

  function handleBlockClick(blockId: string, blockType: string, blockTitle: string | null) {
    try {
      if (typeof window !== "undefined" && window.posthog) {
        window.posthog.capture("store_block_click", {
          org_id: orgId,
          org_slug: orgSlug,
          block_id: blockId,
          block_type: blockType,
          block_title: blockTitle,
        });
      }
    } catch {
      // analytics should never break the page
    }
  }

  return (
    <div className="s-layout">
      <StoreProfile
        displayName={displayName}
        bio={bio}
        photoUrl={photoUrl}
        coverImageUrl={coverImageUrl}
        socialLinks={socialLinks}
        orgId={orgId}
        orgSlug={orgSlug}
        hasProducts={offers.length > 0}
      />

      <main className="s-main" id="produtos">
        {featured && (
          <FeaturedProduct block={featured} orgSlug={orgSlug} discountPromoCodeId={discountPromoCodeId} onBlockClick={handleBlockClick} />
        )}

        {rest.length > 0 && (
          <section aria-labelledby="s-all">
            <div className="s-sec-h">
              <h2 id="s-all" className="s-display">{featured ? "Mais produtos" : "Produtos"}</h2>
              <span>{visible.length} {visible.length === 1 ? "item" : "itens"}</span>
            </div>
            {showFilters && (
              <div className="s-chips" role="group" aria-label="Filtrar por tipo">
                <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Todos</button>
                {kinds.map((k) => (
                  <button type="button" key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{KIND_FILTER_LABEL[k]}</button>
                ))}
              </div>
            )}
            <div className="s-grid">
              {visible.map((block, i) => (
                <ProductCard key={block.id} block={block} index={i} orgSlug={orgSlug} discountPromoCodeId={discountPromoCodeId} onBlockClick={handleBlockClick} />
              ))}
            </div>
          </section>
        )}

        {offers.length === 0 && linkBlocks.length === 0 && (
          <div className="s-empty">Em breve, novidades por aqui.</div>
        )}

        {offers.length > 0 && (
          <section className="s-trust" aria-label="Compra segura">
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></svg>
              <div><b>Pagamento seguro</b><span>Seus dados protegidos no checkout</span></div>
            </div>
            {anyInstant && (
              <div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
                <div><b>Acesso imediato</b><span>Receba logo após o pagamento</span></div>
              </div>
            )}
          </section>
        )}

        {linkBlocks.length > 0 && (
          <section aria-labelledby="s-links">
            <div className="s-sec-h"><h2 id="s-links" className="s-display">Links úteis</h2></div>
            <div className="s-links">
              {linkBlocks.map((block) => (
                <LinkRow key={block.id} block={block} onBlockClick={handleBlockClick} />
              ))}
            </div>
          </section>
        )}

        <p className="s-made">
          Loja feita com <a href="/criadores"><b>i</b>Inboxy</a> · Crie a sua grátis
        </p>
      </main>

      {featured && isPurchasable(featured) && (
        <BuyBar block={featured} orgSlug={orgSlug} discountPromoCodeId={discountPromoCodeId} onBlockClick={handleBlockClick} />
      )}
    </div>
  );
}

/** Phone-only bar that appears once the featured product scrolls out of view. */
function BuyBar({ block, orgSlug, discountPromoCodeId, onBlockClick }: {
  block: StoreBlock; orgSlug: string; discountPromoCodeId?: string; onBlockClick: (id: string, type: string, title: string | null) => void;
}) {
  const { buy, pending } = useBlockCheckout(block, orgSlug, discountPromoCodeId, onBlockClick);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const target = document.getElementById("destaque");
    if (!target) return;
    const io = new IntersectionObserver(([entry]) => setOn(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(target);
    return () => io.disconnect();
  }, []);

  const suffix = recurringSuffix(block);
  return (
    <div className={`s-buybar${on ? " is-on" : ""}`} aria-hidden={!on}>
      <div>
        <span>{block.title}</span>
        <b className="s-mono">{block.price_display}{suffix && <small> {suffix}</small>}</b>
      </div>
      <button type="button" className="s-btn s-btn-primary" onClick={buy} disabled={pending} tabIndex={on ? 0 : -1}>
        {pending ? "Aguarde..." : ctaLabel(block)}
      </button>
    </div>
  );
}
