export interface StoreThemePreset {
  id: string;
  name: string;
  description: string;
  theme: StoreTheme;
}

export interface StoreTheme {
  colorScheme: "light" | "dark";
  primaryColor: string;
  backgroundColor: string;
  cardColor: string;
  textColor: string;
  fontFamily: "geist" | "inter" | "poppins" | "playfair";
  borderRadius: "sm" | "md" | "lg" | "full";
  cardLayout: "horizontal" | "vertical";
  profileLayout: "centered" | "hero";
  coverImageUrl: string | null;
}

export const STORE_THEME_PRESETS: StoreThemePreset[] = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Limpo e neutro — funciona para qualquer nicho",
    theme: { colorScheme: "light", primaryColor: "#6366f1", backgroundColor: "#ffffff", cardColor: "#f8f9fa", textColor: "#1a1a2e", fontFamily: "geist", borderRadius: "lg", cardLayout: "horizontal", profileLayout: "centered", coverImageUrl: null },
  },
  {
    id: "dark-pro",
    name: "Dark Pro",
    description: "Escuro e sofisticado — tech, SaaS, programação",
    theme: { colorScheme: "dark", primaryColor: "#a78bfa", backgroundColor: "#0f0f0f", cardColor: "#1a1a1a", textColor: "#e5e7eb", fontFamily: "geist", borderRadius: "md", cardLayout: "vertical", profileLayout: "centered", coverImageUrl: null },
  },
  {
    id: "creator",
    name: "Creator",
    description: "Vibrante e moderno — criadores de conteúdo",
    theme: { colorScheme: "light", primaryColor: "#a855f7", backgroundColor: "#fdf4ff", cardColor: "#f3e8ff", textColor: "#1e0a2e", fontFamily: "poppins", borderRadius: "full", cardLayout: "horizontal", profileLayout: "centered", coverImageUrl: null },
  },
  {
    id: "educator",
    name: "Educator",
    description: "Profissional e confiável — cursos e mentorias",
    theme: { colorScheme: "light", primaryColor: "#3b82f6", backgroundColor: "#eff6ff", cardColor: "#dbeafe", textColor: "#1e3a5f", fontFamily: "inter", borderRadius: "lg", cardLayout: "vertical", profileLayout: "centered", coverImageUrl: null },
  },
  {
    id: "premium",
    name: "Premium",
    description: "Quente e exclusivo — alto ticket, luxo",
    theme: { colorScheme: "dark", primaryColor: "#f59e0b", backgroundColor: "#1c1917", cardColor: "#292524", textColor: "#fef3c7", fontFamily: "playfair", borderRadius: "md", cardLayout: "horizontal", profileLayout: "centered", coverImageUrl: null },
  },
  {
    id: "fresh",
    name: "Fresh",
    description: "Natural e acolhedor — saúde, bem-estar, educação",
    theme: { colorScheme: "light", primaryColor: "#16a34a", backgroundColor: "#f0fdf4", cardColor: "#dcfce7", textColor: "#14532d", fontFamily: "poppins", borderRadius: "full", cardLayout: "horizontal", profileLayout: "centered", coverImageUrl: null },
  },
  {
    id: "tech-blue",
    name: "Tech Blue",
    description: "Navy + ciano — marketing digital, infoprodutores tech",
    theme: { colorScheme: "dark", primaryColor: "#22d3ee", backgroundColor: "#080d1a", cardColor: "#0f1a2e", textColor: "#e2e8f0", fontFamily: "geist", borderRadius: "md", cardLayout: "horizontal", profileLayout: "hero", coverImageUrl: null },
  },
  {
    id: "sport-gold",
    name: "Sport Gold",
    description: "Charcoal + dourado — fitness, esporte, alta performance",
    theme: { colorScheme: "dark", primaryColor: "#d4af37", backgroundColor: "#0c1118", cardColor: "#1a2033", textColor: "#f5f5f0", fontFamily: "playfair", borderRadius: "sm", cardLayout: "vertical", profileLayout: "hero", coverImageUrl: null },
  },
];

export const DEFAULT_STORE_THEME: StoreTheme = {
  colorScheme: "light",
  primaryColor: "#6366f1",
  backgroundColor: "#ffffff",
  cardColor: "#f8f9fa",
  textColor: "#1a1a2e",
  fontFamily: "geist",
  borderRadius: "lg",
  cardLayout: "horizontal",
  profileLayout: "centered",
  coverImageUrl: null,
};

export function parseStoreTheme(raw: unknown): StoreTheme {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STORE_THEME };
  const obj = raw as Record<string, unknown>;
  return {
    colorScheme: obj.colorScheme === "dark" ? "dark" : "light",
    primaryColor: typeof obj.primaryColor === "string" ? obj.primaryColor : DEFAULT_STORE_THEME.primaryColor,
    backgroundColor: typeof obj.backgroundColor === "string" ? obj.backgroundColor : DEFAULT_STORE_THEME.backgroundColor,
    cardColor: typeof obj.cardColor === "string" ? obj.cardColor : DEFAULT_STORE_THEME.cardColor,
    textColor: typeof obj.textColor === "string" ? obj.textColor : DEFAULT_STORE_THEME.textColor,
    fontFamily: ["geist", "inter", "poppins", "playfair"].includes(obj.fontFamily as string)
      ? (obj.fontFamily as StoreTheme["fontFamily"])
      : DEFAULT_STORE_THEME.fontFamily,
    borderRadius: ["sm", "md", "lg", "full"].includes(obj.borderRadius as string)
      ? (obj.borderRadius as StoreTheme["borderRadius"])
      : DEFAULT_STORE_THEME.borderRadius,
    cardLayout: obj.cardLayout === "vertical" ? "vertical" : "horizontal",
    profileLayout: obj.profileLayout === "hero" ? "hero" : "centered",
    coverImageUrl: typeof obj.coverImageUrl === "string" ? obj.coverImageUrl : null,
  };
}

export function storeThemeToCssVars(theme: StoreTheme): Record<string, string> {
  const radiusMap = { sm: "0.25rem", md: "0.5rem", lg: "0.75rem", full: "9999px" };
  return {
    "--store-primary": theme.primaryColor,
    "--store-bg": theme.backgroundColor,
    "--store-card": theme.cardColor,
    "--store-text": theme.textColor,
    "--store-radius": radiusMap[theme.borderRadius],
  };
}
