import "server-only";
import { defaultLocale, type Locale } from "./config";

const dictionaries = {
  pt: () => import("./dictionaries/pt.json").then((module) => module.default),
  en: () => import("./dictionaries/en.json").then((module) => module.default),
};

type DictionaryLoader = (typeof dictionaries)[keyof typeof dictionaries];
export type Dictionary = Awaited<ReturnType<DictionaryLoader>>;

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const loadDictionary = dictionaries[locale] ?? dictionaries[defaultLocale];
  return loadDictionary();
}
