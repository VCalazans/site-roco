"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Search, X } from "lucide-react";
import { cn } from "@/core/lib/utils";
import type { Locale } from "@/i18n/config";
import {
  LanguageSwitcher,
  type LanguageSwitcherLabels,
} from "@/shared/components/nav/language-switcher";
import { productSearchHref, type HeaderSearchLabels } from "@/shared/components/nav/header-search";
import { NavItems } from "@/shared/components/nav/nav-items";
import { navLabelClass, type NavLink } from "@/shared/lib/nav";

type MobileMenuProps = {
  links: NavLink[];
  /** aria-label for the toggle when the menu is closed / open. */
  labels: { open: string; close: string };
  locale: Locale;
  languageLabels: LanguageSwitcherLabels;
  /** Busca de produtos no topo do painel (`dictionary.navigation.search`). */
  searchLabels: HeaderSearchLabels;
};

/**
 * Mobile nav — painel FULL-WIDTH ancorado sob a faixa fixa do `SiteHeader`
 * (padrão WEG), no lugar do dropdown-cartão pequeno anterior: itens em coluna
 * com alvo de toque generoso (py-3.5), backdrop escurecendo a página e trava
 * de scroll do body enquanto aberto. Fecha em Escape, no backdrop, e ao
 * escolher qualquer item.
 *
 * `top-16 md:top-20` espelha a altura da faixa do header (h-16 / md:h-20);
 * se a altura da barra mudar lá, precisa mudar aqui junto.
 */
export function MobileMenu({
  links,
  labels,
  locale,
  languageLabels,
  searchLabels,
}: MobileMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const searchInputId = useId();
  const close = () => setOpen(false);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(productSearchHref(locale, term));
    setTerm("");
    close();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);

    // Fecha ao CRUZAR o breakpoint `lg`. O wrapper deste componente no
    // `SiteHeader` é `lg:hidden` — `display:none` esconde, mas NÃO desmonta o
    // React: sem este listener, `open` fica preso em `true`, o cleanup abaixo
    // nunca roda e o body permanece com `overflow:hidden`. Como o botão, o
    // backdrop e o painel estão TODOS dentro do subárvore escondido, não sobra
    // nenhum controle visível para destravar — a página inteira de `(site)`
    // fica sem rolagem (reproduz girando um iPad de retrato para paisagem com
    // o menu aberto, ou arrastando a janela do desktop de 1000 → 1100px).
    // 64rem = o `lg` do Tailwind; se o corte da barra mudar no `SiteHeader`,
    // precisa mudar aqui junto.
    const desktop = window.matchMedia("(min-width: 64rem)");
    const onBreakpoint = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", onBreakpoint);

    // Trava o scroll da página enquanto o painel está aberto — sem isso o
    // conteúdo rola por baixo do backdrop e o menu "escapa" do dedo no toque.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onBreakpoint);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? labels.close : labels.open}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative z-50 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop: escurece o conteúdo e fecha no toque fora. */}
            <motion.button
              key="backdrop"
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30 cursor-default bg-black/50"
            />

            <motion.div
              key="panel"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-0 top-16 z-40 flex max-h-[calc(100svh-4rem)] flex-col gap-1 overflow-y-auto border-b border-white/10 bg-[#05070b]/95 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl md:top-20"
            >
              {/* Busca de produtos — no mobile ela mora aqui (a barra não tem
                  espaço para mais um botão ao lado de orçamento/login/menu).
                  Enter leva à listagem já filtrada. */}
              <form role="search" onSubmit={handleSearch} className="mb-2 flex items-center gap-2">
                <label htmlFor={searchInputId} className="sr-only">
                  {searchLabels.label}
                </label>
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/40"
                    aria-hidden
                  />
                  <input
                    id={searchInputId}
                    type="search"
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder={searchLabels.placeholder}
                    autoComplete="off"
                    enterKeyHint="search"
                    maxLength={80}
                    className="w-full rounded-full border border-white/15 bg-white/5 py-3 pl-11 pr-4 text-body text-white outline-none transition placeholder:text-white/40 focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/25"
                  />
                </div>
                <button
                  type="submit"
                  aria-label={searchLabels.submit}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan-bright transition hover:bg-neon-cyan/20"
                >
                  <Search className="size-[18px]" aria-hidden />
                </button>
              </form>

              <NavItems
                links={links}
                onSelect={close}
                // O alvo de toque vem do `py-3.5`, NÃO do tamanho da fonte:
                // 14px × leading 1.25 + 28px de padding = 45,5px, acima dos
                // 44px do WCAG 2.5.5 (AAA). Havia um `text-ui` aqui que nunca
                // se aplicou — `text-ui` e `text-nav` estão no mesmo grupo
                // `font-size` de `cn()` (ver `@/core/lib/utils`), então o
                // segundo descartava o primeiro em silêncio. Removido para o
                // painel medir o que parece medir.
                itemClassName={(_index, isActive) =>
                  cn(
                    "rounded-xl px-4 py-3.5 hover:bg-white/5 active:bg-white/10",
                    navLabelClass(isActive, "menu")
                  )
                }
              />

              {/* Filete dual-tone separando NAVEGAÇÃO dos CONTROLES — mesmo
                  papel do divisor vertical da barra desktop. */}
              <div
                aria-hidden
                className="my-2 h-px w-full bg-gradient-to-r from-neon-cyan/50 via-white/10 to-neon-amber/50"
              />

              {/* Seletor de idioma: no mobile ele mora AQUI e não na barra.
                  Trocar de idioma é ação rara (uma vez por visitante, no
                  máximo), enquanto a barra de 320px já divide o espaço entre
                  logotipo, botão de login e hambúrguer; dentro do painel ele
                  ainda ganha um alvo de toque full-width, maior que qualquer
                  pílula que coubesse lá fora. */}
              <LanguageSwitcher
                locale={locale}
                labels={languageLabels}
                variant="menu"
                onSelect={close}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
