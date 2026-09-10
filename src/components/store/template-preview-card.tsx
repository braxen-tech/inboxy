"use client";

import { useState } from "react";
import { Monitor, Smartphone, Check } from "lucide-react";
import type { StoreTemplate } from "@/lib/store-theme";

interface TemplatePreviewCardProps {
  template: StoreTemplate;
  isActive: boolean;
  onSelect: () => void;
}

export function TemplatePreviewCard({ template, isActive, onSelect }: TemplatePreviewCardProps) {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full overflow-hidden rounded-xl border-2 text-left transition-all hover:shadow-lg ${
        isActive ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
      }`}
    >
      {isActive && (
        <div className="absolute top-3 right-3 z-10 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3.5" />
        </div>
      )}

      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        <img
          src={view === "desktop" ? template.previewDesktop : template.previewMobile}
          alt={`Preview ${template.name}`}
          className={`h-full w-full transition-transform duration-300 group-hover:scale-[1.02] ${
            view === "desktop" ? "object-cover" : "object-contain"
          }`}
        />

        <div className="absolute bottom-2 right-2 z-10 flex gap-1 rounded-lg bg-black/60 p-1 backdrop-blur-sm">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setView("desktop"); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setView("desktop"); } }}
            className={`rounded-md p-1 transition-colors ${view === "desktop" ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80"}`}
          >
            <Monitor className="size-3.5" />
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setView("mobile"); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setView("mobile"); } }}
            className={`rounded-md p-1 transition-colors ${view === "mobile" ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80"}`}
          >
            <Smartphone className="size-3.5" />
          </span>
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className="size-3 rounded-full border border-black/10"
              style={{ background: template.theme.backgroundColor }}
            />
            <span
              className="size-3 rounded-full border border-black/10"
              style={{ background: template.theme.primaryColor }}
            />
            <span
              className="size-3 rounded-full border border-black/10"
              style={{ background: template.theme.cardColor }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{template.category}</span>
        </div>
        <p className="mt-1 text-sm font-semibold">{template.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
      </div>
    </button>
  );
}
