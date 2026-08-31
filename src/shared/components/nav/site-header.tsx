"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/core/lib/utils";
import type { Locale } from "@/i18n/config";
import { CartNavLink } from "@/shared/components/cart";
import {
  LanguageSwitcher,
  type LanguageSwitcherLabels,
} from "@/shared/components/nav/language-switcher";
import { MobileMenu } from "@/shared/components/nav/mobile-menu";
import { NavItems } from "@/shared/components/nav/nav-items";
import { PortalLoginLink } from "@/shared/components/nav/portal-login-link";
import { navLabelClass, type NavLink } from "@/shared/lib/nav";

/**
 * Logotipo 2D limpo — fundo transparente de verdade.
 *
 * Substitui `roco-logo-white.png`, que carregava uma névoa branca diagonal
 * (bleed da extração do render: as letras ficam em alfa 255, mas ~37% da
 * imagem era branco semitransparente). Este asset foi gerado limpando o canal
 * alfa e recortando a bbox real das letras. Deve ser o ÚNICO logo usado no
 * site — ver também `app/layout.tsx`.
 */
const LOGO = "/images/hero/roco-logo.png";

type SiteHeaderProps = {
  brand: string;
  links: NavLink[];
  menuLabels: { open: string; close: string };
  /** Locale da rota — alimenta o seletor de idioma e o link do portal. */
  locale: Locale;
  /** Rótulos dos controles da direita (dicionário, nunca hardcode). */
  controls: {
    language: LanguageSwitcherLabels;
    /** Nome acessível do botão de login (só ícone na barra). */
    portalLogin: string;
    /** Nome acessível do ícone do carrinho de cotação (só ícone na barra) —
     *  `dictionary.cart.nav.label`. */
    cart: string;
  };
};

/**
 * Barra de navegação dinâmica no padrão WEG (ver
 * `docs/referencia weg/home/image1.png`): faixa FIXA de borda a borda,
 * translúcida sobre o hero (backdrop-blur), que ganha fundo mais sólido ao
 * rolar — em vez do card flutuante `.nav-glass` anterior, que era `absolute`
 * e desaparecia no primeiro scroll (débito registrado no progress.md).
 *
 * Identidade ROCO preservada: filete gradiente ciano→âmbar na base da faixa
 * (o mesmo pareamento dual-tone do render) e rótulos via `navLabelClass`.
 *
 * Todas as páginas de `(site)` já reservam `pt-20+` no conteúdo (a barra
 * anterior também flutuava sobre ele), então a troca absolute→fixed não move
 * nenhum layout — só mantém a barra visível durante a rolagem.
 */
export function SiteHeader({
  brand,
  links,
  menuLabels,
  locale,
  controls,
}: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* Fundo translúcido em camada própria: `backdrop-filter` cria
          containing block para descendentes `fixed` — se ficasse no <header>,
          o painel/backdrop do MobileMenu (fixed) seria ancorado à faixa em vez
          da viewport e o backdrop cobriria só a barra. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 backdrop-blur-lg transition-colors duration-300",
          scrolled
            ? "bg-[#05070b]/90 shadow-[0_10px_40px_rgba(0,0,0,0.45)]"
            : "bg-[#05070b]/40"
        )}
      />

      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 md:h-20">
        <Link href="/" aria-label={brand} className="flex-shrink-0">
          <Image
            src={LOGO}
            alt={brand}
            // Dimensões INTRÍNSECAS do arquivo (306×133). Estavam declaradas
            // como 300×122: antes de decodificar o PNG o navegador reserva
            // altura×(w/h) do que foi declarado, então a faixa reservava
            // 98,4px de largura e encolhia para 92,0px ao carregar — ~6px de
            // CLS no elemento mais estável da página.
            width={306}
            height={133}
            priority
            className="h-8 w-auto md:h-10"
          />
        </Link>

        {/* Bloco da direita: nav + divisor + controles (idioma, login). Fica
            num flex próprio para que o divisor tenha vizinhos previsíveis e
            para que os controles não escapem para o meio da barra quando a
            nav colapsa. */}
        <div className="flex items-center gap-3 lg:gap-4">
          {/* Lista horizontal em LINHA ÚNICA. O corte segue em `lg`, agora com
              medida e não por impressão: com os TRÊS controles (idioma,
              carrinho, login), o conjunto (5 rótulos + divisor + seletor +
              carrinho + login) mede 776px em pt e 757px em en a 1024px,
              contra 868px disponíveis — folga de 92px (pt) / 111px (en).
              Remedição 2026-08-30 ao acrescentar o ícone do carrinho:
              partiu-se dos 728px/709px já medidos em 2026-07-19 (nav +
              divisor + idioma + login) e somou-se só o DELTA do botão novo —
              `size-10` (40px) mais UM gap adicional do flex `gap-2` que o
              envolve (8px), pois ele entra como terceiro filho desse
              contêiner, ANTES do login — 48px ao todo. A barra só deixaria
              de caber abaixo de ~900px; subir o corte para `xl` esconderia
              uma barra que ainda cabe com folga de duas dígitos.
              Larguras medidas com as métricas reais do arquivo Inter servido
              pelo `next/font` (hmtx + HVAR em wght 500), a 14px e 0.04em. */}
          <nav aria-label={brand} className="hidden lg:block">
            <ul className="flex items-center gap-6 xl:gap-9">
              <NavItems
                links={links}
                itemClassName={(_index, isActive) => navLabelClass(isActive, "bar")}
                wrapItem={(node, key) => <li key={key}>{node}</li>}
              />
            </ul>
          </nav>

          {/* Divisor sutil separando NAVEGAÇÃO (onde ir) de CONTROLES (idioma,
              entrar). Só existe quando a nav está visível — no mobile não há
              o que separar. */}
          <span
            aria-hidden
            className="hidden h-5 w-px bg-white/15 lg:block"
          />

          <div className="flex items-center gap-2">
            {/* Seletor de idioma: pílula de texto no desktop; no mobile ele
                vive DENTRO do painel do hambúrguer (ver `MobileMenu`), porque
                é uma ação rara e ocuparia largura de barra que o logotipo e os
                dois botões já consomem. */}
            <LanguageSwitcher
              locale={locale}
              labels={controls.language}
              variant="bar"
              className="hidden lg:inline-flex"
            />

            {/* Carrinho de cotação: fica na barra em TODOS os tamanhos, como
                o login logo abaixo — não há painel "menu" dedicado para ele
                (ver o comentário em `PortalLoginLink` sobre a variante
                `"menu"`), porque não há nada a esconder abaixo de `lg`: o
                ícone já é sempre visível ao lado do hambúrguer. */}
            <CartNavLink locale={locale} label={controls.cart} />

            {/* Login fica na barra em TODOS os tamanhos — é destino de tarefa
                de quem já é representante, e vale o toque único. */}
            <PortalLoginLink locale={locale} label={controls.portalLogin} variant="bar" />

            {/* Abaixo de `lg`: colapsa no hambúrguer (painel full-width) */}
            <div className="lg:hidden">
              <MobileMenu
                links={links}
                labels={menuLabels}
                locale={locale}
                languageLabels={controls.language}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filete dual-tone da marca — fecha a faixa como o neon fecha a barra
          assada no render (ciano à esquerda, âmbar à direita). */}
      <div
        aria-hidden
        className={cn(
          "relative h-px w-full bg-gradient-to-r from-neon-cyan/70 via-white/10 to-neon-amber/70 transition-opacity duration-300",
          scrolled ? "opacity-100" : "opacity-60"
        )}
      />
    </header>
  );
}
