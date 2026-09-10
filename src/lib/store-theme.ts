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

export interface StoreTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  previewDesktop: string;
  previewMobile: string;
  theme: StoreTheme;
}

export const STORE_TEMPLATES: StoreTemplate[] = [
  {
    id: "wellness",
    name: "Bem-estar",
    description: "Elegante e acolhedor — spa, estética, terapias, saúde",
    category: "Bem-estar",
    previewDesktop: "/store-templates/wellness-desktop.png",
    previewMobile: "/store-templates/wellness-mobile.png",
    theme: {
      colorScheme: "light",
      primaryColor: "#b8860b",
      backgroundColor: "#faf6f0",
      cardColor: "#f5ede3",
      textColor: "#3d2e1f",
      fontFamily: "playfair",
      borderRadius: "lg",
      cardLayout: "horizontal",
      profileLayout: "hero",
      coverImageUrl: "/store-templates/wellness-desktop.png",
    },
  },
  {
    id: "fitness",
    name: "Fitness",
    description: "Forte e energético — academia, personal, esporte",
    category: "Fitness",
    previewDesktop: "/store-templates/fitness-desktop.png",
    previewMobile: "/store-templates/fitness-mobile.png",
    theme: {
      colorScheme: "dark",
      primaryColor: "#d4af37",
      backgroundColor: "#0c1118",
      cardColor: "#1a2033",
      textColor: "#f5f5f0",
      fontFamily: "inter",
      borderRadius: "md",
      cardLayout: "vertical",
      profileLayout: "hero",
      coverImageUrl: "/store-templates/fitness-desktop.png",
    },
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
