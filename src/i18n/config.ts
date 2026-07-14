export const defaultLocale = "pt";
export const locales = ["pt", "en"] as const;

export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  pt: "Português",
  en: "English",
};
