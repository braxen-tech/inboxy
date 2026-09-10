"use client";

import type { StoreTheme } from "@/lib/store-theme";
import { storeThemeToCssVars } from "@/lib/store-theme";

interface StoreThemeProviderProps {
  theme: StoreTheme;
  children: React.ReactNode;
}

const FONT_MAP: Record<StoreTheme["fontFamily"], string> = {
  geist: "'Geist', system-ui, sans-serif",
  inter: "'Inter', system-ui, sans-serif",
  poppins: "'Poppins', system-ui, sans-serif",
  playfair: "'Playfair Display', Georgia, serif",
};

export function StoreThemeProvider({ theme, children }: StoreThemeProviderProps) {
  const cssVars = storeThemeToCssVars(theme);

  return (
    <div
      style={{
        ...cssVars,
        fontFamily: FONT_MAP[theme.fontFamily],
        backgroundColor: "var(--store-bg)",
        color: "var(--store-text)",
      } as React.CSSProperties}
      className="relative min-h-screen"
    >
      {theme.coverImageUrl && (
        <>
          <div
            className="fixed inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${theme.coverImageUrl})` }}
            aria-hidden="true"
          />
          <div
            className="fixed inset-0"
            style={{ backgroundColor: theme.colorScheme === "dark" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.35)" }}
            aria-hidden="true"
          />
        </>
      )}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
