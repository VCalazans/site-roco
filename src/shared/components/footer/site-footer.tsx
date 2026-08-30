import "server-only";
import Image from "next/image";
import Link from "next/link";
import { Globe, MapPin, Phone } from "lucide-react";
import { resolveDestination } from "@/core/config/site";
import { getContactInfo, getSocialLinks } from "@/server/lib/site-settings";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { FooterLink } from "@/shared/components/footer/footer-link";
import { SocialLink } from "@/shared/components/footer/social-link";

/** Ícones SVG inline das redes sociais (não disponíveis em lucide-react). */
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="currentColor" strokeWidth={2} />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth={2} />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="2" stroke="currentColor" strokeWidth={2} />
      <path d="M7 10v7M7 7v.5M11 17v-4a2 2 0 0 1 4 0v4M11 10v7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="4" stroke="currentColor" strokeWidth={2} />
      <path d="M10 9l5 3-5 3V9z" fill="currentColor" />
    </svg>
  );
}

const SOCIAL_ICON_MAP = {
  instagram: InstagramIcon,
  linkedin: LinkedinIcon,
  youtube: YoutubeIcon,
  whatsapp: Globe,
} as const;

/** Mesmo logotipo 2D limpo usado no `SiteHeader` — ver comentário lá. */
const LOGO = "/images/hero/roco-logo.png";

type SiteFooterProps = {
  content: Dictionary["footer"];
  brand: string;
  locale: Locale;
};

function renderSocialIcon(key: keyof typeof SOCIAL_ICON_MAP) {
  const Icon = SOCIAL_ICON_MAP[key];
  return <Icon key={key} className="size-4" aria-hidden />;
}

/**
 * Rodapé do site público. Dados de contato (telefone, e-mail, endereço) e links
 * de redes sociais vêm de `site_settings` (editável pelo admin), com fallback
 * para texto vazio quando não há valor no banco.
 *
 * Redes sociais: cada chave presente em `site_settings` renderiza o ícone
 * correspondente com link; chaves ausentes não renderizam nada.
 * Ícones de redes sociais usam o tom âmbar da marca para manter coerência
 * com a paleta do site.
 */
export async function SiteFooter({ content, brand, locale }: SiteFooterProps) {
  const [{ phone, email, addressMatriz, addressFilial }, socialLinks] =
    await Promise.all([getContactInfo(), getSocialLinks()]);

  return (
    <footer className="relative border-t border-white/10 bg-[#05070b] px-6 py-14">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        {/* Linha 1: logo + contato | 3 colunas de links */}
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
          {/* Coluna 1: logo + tagline + contato */}
          <div className="flex flex-col gap-4">
            <Link href={`/${locale}`} aria-label={brand} className="w-fit">
              <Image
                src={LOGO}
                alt={brand}
                width={220}
                height={90}
                priority={false}
                className="h-9 w-auto"
              />
            </Link>
            <p className="max-w-xs text-meta text-white/60">{content.tagline}</p>

            {/* Telefone */}
            {phone && (
              <a
                href={`https://wa.me/${phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-meta text-white/60 transition hover:text-neon-amber-bright"
              >
                <Phone className="size-4 shrink-0" aria-hidden />
                {phone}
              </a>
            )}

            {/* E-mail */}
            {email && (
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-2 text-meta text-white/60 transition hover:text-neon-amber-bright"
              >
                <svg
                  aria-hidden
                  className="size-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                {email}
              </a>
            )}

            {/* Endereço matriz */}
            {addressMatriz && (
              <div className="flex items-start gap-2 text-meta text-white/50">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{addressMatriz}</span>
              </div>
            )}

            {/* Endereço filial (texto descritivo, sem CEP/rua) */}
            {addressFilial && (
              <p className="text-meta text-white/40">{addressFilial}</p>
            )}

            {/* Redes sociais */}
            {Object.keys(socialLinks).length > 0 && (
              <div className="flex items-center gap-3 pt-1">
                {(Object.keys(socialLinks) as (keyof typeof SOCIAL_ICON_MAP)[]).map(
                  (key) => {
                    const href = socialLinks[key];
                    if (!href) return null;
                    return (
                      <SocialLink
                        key={key}
                        href={href}
                        label={key.charAt(0).toUpperCase() + key.slice(1)}
                      >
                        {renderSocialIcon(key)}
                      </SocialLink>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* Colunas de links (Produtos, Empresa, Contato) */}
          {content.columns.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <h3 className="text-ui font-semibold text-white/90">{column.title}</h3>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink
                      href={resolveDestination(link.href, locale, "rodape")}
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

        {/* Certificações e selos da empresa. O selo GPTW é a ARTE OFICIAL com
            vigência (fev 2026 – fev 2027), fornecida pelo stakeholder em
            2026-08-23 e processada para PNG transparente (fundo claro
            removido; original de referência em docs/). Itens sem `image`
            caem no ícone genérico. O array nos dicionários
            (`footer.certifications.items`) comporta selos adicionais. */}
        <div className="flex flex-col gap-3 border-t border-white/10 pt-6">
          <h3 className="text-micro uppercase tracking-wide text-white/40">
            {content.certifications.title}
          </h3>
          <ul className="flex flex-wrap gap-3">
            {content.certifications.items.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 shadow-[0_0_24px_-8px_rgba(53,217,255,0.25)]"
              >
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.alt}
                    width={96}
                    height={161}
                    className="h-16 w-auto shrink-0"
                  />
                ) : (
                  <svg
                    aria-hidden
                    className="size-6 shrink-0 text-neon-amber-bright"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                )}
                <div className="flex flex-col">
                  <span className="text-meta font-semibold text-white/90">
                    {item.label}
                  </span>
                  <span className="text-micro text-white/50">{item.note}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-white/10 pt-6">
          <p className="text-micro text-white/40">{content.rights}</p>
        </div>
      </div>
    </footer>
  );
}
