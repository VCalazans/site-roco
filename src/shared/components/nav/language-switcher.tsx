"use client";

import type { MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/core/lib/utils";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { alternateLocale, switchLocalePath } from "@/shared/lib/locale-path";

export type LanguageSwitcherLabels = {
  /** Nome acessível do controle ("Mudar idioma" / "Change language"). */
  action: string;
};

type LanguageSwitcherProps = {
  /** Locale da página atual (vem do servidor, não do pathname). */
  locale: Locale;
  labels: LanguageSwitcherLabels;
  /**
   * `"bar"` = pílula compacta na barra do desktop;
   * `"menu"` = linha full-width dentro do painel mobile (alvo de toque).
   */
  variant?: "bar" | "menu";
  /** Fecha o painel mobile ao escolher (mesmo contrato de `NavItems`). */
  onSelect?: () => void;
  className?: string;
};

/**
 * Seletor de idioma — PT ⇄ EN.
 *
 * Padrão adotado: U.S. Web Design System, "Select a language / Two languages"
 * — com exatamente dois idiomas, um BOTÃO que mostra o idioma de DESTINO, no
 * PRÓPRIO idioma de destino ("English" numa página pt, "Português" numa en),
 * em vez de um dropdown. Três decisões deliberadas:
 *
 *  - SEM BANDEIRA. O W3C é explícito ("Don't use flags to indicate languages!
 *    Flags represent countries, not languages") e só abre exceção para sites
 *    segmentados por região — não é o caso aqui: `/pt` e `/en` são o mesmo
 *    conteúdo, do mesmo país.
 *  - SEM SIGLA ("PT"/"EN"). Autônimo por recomendação de a11y; siglas de duas
 *    letras são alvo de tradução automática do navegador, que garbleia o menu.
 *  - SEM ÍCONE DE GLOBO. O rodapé já usa o globo do lucide como ícone do
 *    WhatsApp (`SOCIAL_ICON_MAP`); dois globos com significados diferentes na
 *    mesma página seria pior que texto puro. Texto também mantém a barra
 *    uniforme, que é o padrão WEG pedido pelo stakeholder (ver `navLabelClass`).
 *
 * O rótulo carrega `lang` do idioma de destino (WCAG SC 3.1.2, "Language of
 * Parts"): sem isso o leitor de tela pronuncia "English" com fonemas
 * portugueses.
 *
 * O nome acessível vem do CONTEÚDO, de propósito — e é por isso que NÃO há
 * `aria-label` aqui. Havia um até 2026-08-30, e ele anulava o `lang`: pelo
 * algoritmo de nome acessível, `aria-label` (passo 2C) encerra a computação
 * antes do conteúdo da subárvore (passo 2F), então o `<span lang>` nunca era
 * consultado e o nome virava uma string plana no idioma do documento — a
 * marcação prometia exatamente o que este bloco descreve e não entregava.
 * `aria-labelledby` teria o mesmo defeito (também achata para string única).
 * O separador vive DENTRO do texto `sr-only` porque dois `<span>` adjacentes
 * são conteúdo "phrasing" e a composição do nome não insere espaço entre
 * eles: sem ele, o nome sairia "Mudar idiomaEnglish".
 *
 * NAVEGAÇÃO POR DOCUMENTO INTEIRO, de propósito. O `<html lang>` é emitido no
 * root layout, que fica ACIMA do segmento `[locale]` e é COMPARTILHADO por
 * `/pt/*` e `/en/*`; numa navegação client-side do App Router os layouts
 * compartilhados não re-renderizam, então a página trocaria de idioma com o
 * `lang` antigo grudado — página em inglês anunciada como `lang="pt"` (SC
 * 3.1.1). Um `<a>` cru resolve por construção, e ainda deixa o middleware
 * regravar o cookie `NEXT_LOCALE` na mesma requisição.
 *
 * QUERYSTRING: o `href` renderizado carrega só o caminho, porque
 * `useSearchParams` obrigaria uma fronteira `<Suspense>` em todas as páginas
 * que pré-renderizam estaticamente, e ler `window.location` durante o render
 * divergiria do HTML do servidor (mismatch de hidratação no atributo). Em vez
 * disso o clique simples lê a URL VIVA no momento do clique — o que também
 * captura o que o `history.replaceState` do explorador de produtos escreveu,
 * invisível para `useSearchParams`. Clique com modificador (nova aba, meio)
 * cai no `href` cru: leva à página traduzida, sem os filtros. É a degradação
 * aceitável; o inverso (href estático com query congelada no SSR) mentiria.
 */
export function LanguageSwitcher({
  locale,
  labels,
  variant = "bar",
  onSelect,
  className,
}: LanguageSwitcherProps) {
  const pathname = usePathname();
  const target = alternateLocale(locale, locales);
  const href = switchLocalePath(pathname ?? `/${locale}`, target, locales);

  // Um único locale configurado: não há para onde trocar.
  if (target === locale) return null;

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onSelect?.();

    // Deixa o navegador cuidar de nova aba / nova janela / download.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    const { pathname: livePath, search, hash } = window.location;
    window.location.assign(
      switchLocalePath(`${livePath}${search}${hash}`, target, locales)
    );
  };

  return (
    <a
      href={href}
      hrefLang={target}
      onClick={onClick}
      className={cn(
        "text-nav whitespace-nowrap uppercase text-white/85 transition-colors hover:text-white",
        // `h-10` casa a pílula com o botão de login (também 40px), para os dois
        // controles lerem como um par — e sobe o alvo de toque bem acima dos
        // 24px do WCAG 2.5.8. `items-center` é explícito porque um `<a>` só
        // vira bloco por blockificação do flex pai; não dependemos disso.
        variant === "bar"
          ? "inline-flex h-10 items-center rounded-full border border-white/15 px-3.5 hover:border-white/30 hover:bg-white/5"
          : "block w-full rounded-xl px-4 py-3.5 text-left hover:bg-white/5 active:bg-white/10",
        className
      )}
    >
      <span className="sr-only">{`${labels.action}: `}</span>
      <span lang={target}>{localeNames[target]}</span>
    </a>
  );
}
