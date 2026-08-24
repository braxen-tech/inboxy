"use client";

import { Clock, ExternalLink } from "lucide-react";

interface StoreBlock {
  id: string;
  type: "product" | "booking" | "link";
  title: string | null;
  description: string | null;
  image_url: string | null;
  cta_text: string;
  external_url: string | null;
  price_display: string | null;
  duration_minutes: number | null;
  link_icon: string | null;
}

interface StoreBlockCardProps {
  block: StoreBlock;
  cardLayout: "horizontal" | "vertical";
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
  onBlockClick,
}: {
  block: StoreBlock;
  cardLayout: "horizontal" | "vertical";
  onBlockClick?: StoreBlockCardProps["onBlockClick"];
}) {
  const isHorizontal = cardLayout === "horizontal";

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

        {block.external_url && (
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
        )}
      </div>
    </div>
  );
}

export function StoreBlockCard({ block, cardLayout, onBlockClick }: StoreBlockCardProps) {
  if (block.type === "link") {
    return <LinkCard block={block} onBlockClick={onBlockClick} />;
  }
  return <ProductOrBookingCard block={block} cardLayout={cardLayout} onBlockClick={onBlockClick} />;
}
