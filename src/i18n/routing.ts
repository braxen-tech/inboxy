import { defineRouting } from "next-intl/routing";

// Para adicionar um novo idioma: inserir o código aqui + criar messages/<codigo>.json
export const routing = defineRouting({
  locales: ["pt", "en"],
  defaultLocale: "pt",
  localePrefix: "never",
});

export type Locale = (typeof routing.locales)[number];
