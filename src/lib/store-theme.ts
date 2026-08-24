export interface StoreTheme {
  colorScheme: "light" | "dark";
  primaryColor: string;
  backgroundColor: string;
  cardColor: string;
  textColor: string;
  fontFamily: "geist" | "inter" | "poppins" | "playfair";
  borderRadius: "sm" | "md" | "lg" | "full";
  cardLayout: "horizontal" | "vertical";
  coverImageUrl: string | null;
}

export const DEFAULT_STORE_THEME: StoreTheme = {
  colorScheme: "light",
  primaryColor: "#6366f1",
  backgroundColor: "#ffffff",
  cardColor: "#f8f9fa",
  textColor: "#1a1a2e",
  fontFamily: "geist",
  borderRadius: "lg",
  cardLayout: "horizontal",
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
