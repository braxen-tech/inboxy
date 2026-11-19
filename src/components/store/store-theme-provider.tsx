"use client";

import type { StoreTheme } from "@/lib/store-theme";
import { storeThemeToCssVars } from "@/lib/store-theme";
import "./store.css";

interface StoreThemeProviderProps {
  theme: StoreTheme;
  children: React.ReactNode;
}

/** Font used for the store's headings; body text always uses Geist (Inboxy design system). */
const FONT_MAP: Record<StoreTheme["fontFamily"], string> = {
  geist: "var(--font-geist-sans), 'Geist', system-ui, sans-serif",
  bricolage: "var(--font-bricolage), 'Bricolage Grotesque', system-ui, sans-serif",
  inter: "'Inter', system-ui, sans-serif",
  poppins: "'Poppins', system-ui, sans-serif",
  playfair: "'Playfair Display', Georgia, serif",
};

export function StoreThemeProvider({ theme, children }: StoreThemeProviderProps) {
  const cssVars = storeThemeToCssVars(theme);

  return (
    <div
      style={{ ...cssVars, "--store-display": FONT_MAP[theme.fontFamily] } as React.CSSProperties}
      className={`ibx-store${theme.colorScheme === "dark" ? " is-dark" : ""}`}
    >
      {children}
    </div>
  );
}
