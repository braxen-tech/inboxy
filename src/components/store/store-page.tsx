"use client";

import { StoreProfile } from "./store-profile";
import { StoreBlockCard } from "./store-block-card";

interface SocialLink {
  platform: string;
  url: string;
}

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

interface StorePageProps {
  displayName: string;
  bio: string | null;
  photoUrl: string | null;
  coverImageUrl: string | null;
  socialLinks: SocialLink[];
  blocks: StoreBlock[];
  cardLayout: "horizontal" | "vertical";
  orgId: string;
  orgSlug: string;
}

export function StorePage({
  displayName,
  bio,
  photoUrl,
  coverImageUrl,
  socialLinks,
  blocks,
  cardLayout,
  orgId,
  orgSlug,
}: StorePageProps) {
  const productAndBookingBlocks = blocks.filter((b) => b.type !== "link");
  const linkBlocks = blocks.filter((b) => b.type === "link");

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
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-16">
      <StoreProfile
        displayName={displayName}
        bio={bio}
        photoUrl={photoUrl}
        coverImageUrl={coverImageUrl}
        socialLinks={socialLinks}
      />

      {productAndBookingBlocks.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {productAndBookingBlocks.map((block) => (
            <StoreBlockCard
              key={block.id}
              block={block}
              cardLayout={cardLayout}
              orgSlug={orgSlug}
              onBlockClick={handleBlockClick}
            />
          ))}
        </div>
      )}

      {linkBlocks.length > 0 && (
        <div className="mt-6 flex flex-col gap-3">
          {linkBlocks.map((block) => (
            <StoreBlockCard
              key={block.id}
              block={block}
              cardLayout={cardLayout}
              orgSlug={orgSlug}
              onBlockClick={handleBlockClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
