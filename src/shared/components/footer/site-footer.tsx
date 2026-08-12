import Image from "next/image";
import Link from "next/link";
import { resolveDestination } from "@/core/config/site";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { FooterLink } from "@/shared/components/footer/footer-link";

/** Mesmo logotipo 2D limpo usado no `SiteHeader` — ver comentário lá. */
const LOGO = "/images/hero/roco-logo.png";

type SiteFooterProps = {
  content: Dictionary["footer"];
  brand: string;
  locale: Locale;
};

/**
 * Rodapé do site público. `socialLabel` é renderizado como texto simples (sem
 * ícones/links de rede social): a pesquisa de referência não confirmou URLs
 * oficiais da ROCO em nenhuma rede, e um botão/ícone sem destino real seria
 * pior que a ausência dele — fica como rótulo textual até haver um link
 * confirmado (ver resumo da tarefa).
 */
export function SiteFooter({ content, brand, locale }: SiteFooterProps) {
  return (
    <footer className="relative border-t border-white/10 bg-[#05070b] px-6 py-14">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
          <div className="flex flex-col gap-4">
            <Link href={`/${locale}`} aria-label={brand} className="w-fit">
              <Image src={LOGO} alt={brand} width={220} height={90} priority={false} className="h-9 w-auto" />
            </Link>
            <p className="max-w-xs text-meta text-white/60">{content.tagline}</p>
            <p className="text-meta text-white/50">{content.addressLabel}</p>
            <p className="text-micro uppercase tracking-wide text-white/35">{content.socialLabel}</p>
          </div>

          {content.columns.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <h3 className="text-ui font-semibold text-white/90">{column.title}</h3>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink
                      href={resolveDestination(link.href, locale)}
                      className="text-meta text-white/60 transition hover:text-neon-cyan-bright"
                    >
                      {link.label}
                    </FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-6">
          <p className="text-micro text-white/40">{content.rights}</p>
        </div>
      </div>
    </footer>
  );
}
