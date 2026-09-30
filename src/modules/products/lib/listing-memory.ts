/**
 * Lembra a última URL da listagem de produtos (com filtros e página) para o
 * botão "Voltar aos produtos" do detalhe (spec 001, RF13). `sessionStorage`
 * porque é memória DE NAVEGAÇÃO desta aba — some ao fechar, não vaza entre
 * abas e não é dado pessoal.
 *
 * Nunca lança (modo privado/storage bloqueado só desliga o recurso) e só
 * aceita caminho interno da própria listagem — um valor adulterado no storage
 * nunca vira redirecionamento para fora do site.
 */
const STORAGE_KEY = "roco:last-products-url";

const LISTING_PATH = /^\/(pt|en)\/produtos(\?[^#]*)?$/;

export function rememberListingUrl(url: string): void {
  if (typeof window === "undefined" || !LISTING_PATH.test(url)) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, url);
  } catch {
    // storage indisponível: o "voltar" cai no destino padrão.
  }
}

/** URL lembrada, se for da listagem do MESMO idioma; senão `fallback`. */
export function recallListingUrl(locale: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored && LISTING_PATH.test(stored) && stored.startsWith(`/${locale}/`)) return stored;
  } catch {
    // idem
  }
  return fallback;
}
