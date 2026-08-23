"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/core/lib/utils";
import { MobileMenu } from "@/shared/components/nav/mobile-menu";
import { NavItems } from "@/shared/components/nav/nav-items";
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
export function SiteHeader({ brand, links, menuLabels }: SiteHeaderProps) {
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
            width={300}
            height={122}
            priority
            className="h-8 w-auto md:h-10"
          />
        </Link>

        {/* Lista horizontal em LINHA ÚNICA. O corte é em `lg`, não `md`:
            entre 768 e 1023px os rótulos desta nav ficam espremidos contra o
            logotipo, e espremer é pior que colapsar. */}
        <nav aria-label={brand} className="hidden lg:block">
          <ul className="flex items-center gap-6 xl:gap-9">
            <NavItems
              links={links}
              itemClassName={(_index, isActive) => navLabelClass(isActive, "bar")}
              wrapItem={(node, key) => <li key={key}>{node}</li>}
            />
          </ul>
        </nav>

        {/* Abaixo de `lg`: colapsa no hambúrguer (painel full-width) */}
        <div className="lg:hidden">
          <MobileMenu links={links} labels={menuLabels} />
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
