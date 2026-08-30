import "server-only";
import Image from "next/image";
import Link from "next/link";
import { Mail } from "lucide-react";
import { resolveDestination } from "@/core/config/site";
import { getContactInfo, getSocialLinks } from "@/server/lib/site-settings";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { FooterLink } from "@/shared/components/footer/footer-link";
import { SocialLink } from "@/shared/components/footer/social-link";
import { formatPhoneDisplayBR } from "@/shared/lib/phone";

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

/**
 * Balão com rabicho + fone, no mesmo traço dos demais. Substitui o `Globe` do
 * lucide, que estava aqui por falta de ícone de marca no pacote: um GLOBO
 * rotulado "WhatsApp" — e o WhatsApp é hoje a única rede configurada, ou seja,
 * era o único ícone que aparecia de fato. A forma foi conferida rasterizando o
 * SVG (sharp/librsvg) — não é palpite de path.
 */
function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.2 20.8l1.4-4.1A8.6 8.6 0 1 1 7.9 20l-4.7.8z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path
        d="M9.3 8.1c-.5 0-.9.3-1 .8-.2.7-.1 1.5.3 2.3.8 1.7 2.3 3.2 4 4 .8.4 1.6.5 2.3.3.5-.1.8-.5.8-1v-1l-1.9-.9-.8 1c-.9-.4-1.7-1.2-2.1-2.1l1-.8-.9-1.9-1.7.3z"
        fill="currentColor"
      />
    </svg>
  );
}

const SOCIAL_ICON_MAP = {
  instagram: InstagramIcon,
  linkedin: LinkedinIcon,
  youtube: YoutubeIcon,
  whatsapp: WhatsappIcon,
} as const;

/**
 * Ordem FIXA de renderização das redes. Iterar `Object.keys(socialLinks)`
 * (como era até 2026-08-30) tinha dois defeitos: a ordem passava a depender de
 * como o JSON foi digitado no admin, e uma chave desconhecida no JSON
 * (`"tiktok"`, um erro de digitação) resolvia `SOCIAL_ICON_MAP[key]` para
 * `undefined` e derrubava a renderização do rodapé inteiro — em TODA página do
 * site, a partir de um campo que o admin edita à mão.
 */
const SOCIAL_ORDER = ["instagram", "linkedin", "youtube", "whatsapp"] as const;

type SocialKey = (typeof SOCIAL_ORDER)[number];

/** Mesmo logotipo 2D limpo usado no `SiteHeader` — ver comentário lá. */
const LOGO = "/images/hero/roco-logo.png";

/**
 * Título de grupo — MESMO papel nas duas bandas (marca/navegação e contato),
 * para o rodapé ter um único nível de cabeçalho.
 *
 * Sem `font-semibold`: `--type-ui-weight` já é 600, então o utilitário era um
 * no-op que só dava a impressão de que o peso morava no className.
 */
const GROUP_TITLE = "text-ui text-white/90";

/**
 * Bloco de texto corrido do rodapé — a medida faz parte do papel.
 *
 * `max-w-xs` (320px) ≈ 43 caracteres do Inter a 14px e, mais importante, é um
 * TETO que não depende do container: no mobile (342px de conteúdo) e na banda
 * de marca esticada em `sm:col-span-2` (até 720px), a linha para de crescer
 * aqui. Os três textos longos do rodapé (tagline, endereço da matriz e
 * descrição da unidade fabril) usam esta MESMA constante — antes só a tagline
 * tinha limite, e eram justamente os dois endereços sem teto que empurravam a
 * primeira coluna para 10 linhas.
 */
const PROSE_BLOCK = "max-w-xs text-meta text-white/60";

type SiteFooterProps = {
  content: Dictionary["footer"];
  brand: string;
  locale: Locale;
};

/**
 * Só http(s) chega a um `href`. `social.links` é JSON livre editado no admin;
 * sem esse filtro, um `javascript:` colado ali viraria link executável em
 * todas as páginas do site.
 */
function isSafeHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function renderSocialIcon(key: SocialKey) {
  const Icon = SOCIAL_ICON_MAP[key];
  return <Icon className="size-4" aria-hidden />;
}

/**
 * Rodapé do site público.
 *
 * LAYOUT (reorganizado em 2026-08-30). Antes: UMA coluna de `1.5fr` acumulava
 * logo + tagline + telefone + e-mail + endereço da matriz + descrição da
 * filial + redes, ao lado de três colunas de 1–2 links. Medido com as métricas
 * reais do Inter servido pelo `next/font`, isso dava um desnível de 291 a
 * 330px entre a primeira coluna e as outras, em TODA largura de tela — e o
 * pior caso era justamente ao ganhar espaço: cruzando 1023→1024px a coluna
 * perdia 39% da largura e ficava mais ALTA (a descrição da filial ia a 4
 * linhas).
 *
 * Agora são DUAS bandas sobre a MESMA grade de 4 colunas (1 no mobile, 2 em
 * `sm`), o que alinha as bordas verticais das duas:
 *   banda 1 — marca (logo + tagline) + as 3 colunas de links;
 *   banda 2 — contato: canais, matriz, unidade fabril e redes sociais,
 *             cada um com rótulo próprio.
 * O desnível cai para 42–66px (banda 1) e 27–66px (banda 2).
 *
 * Dados de contato (telefone, e-mail, endereços) e links de redes vêm de
 * `site_settings` (editável pelo admin). Cada bloco só renderiza quando o dado
 * existe — rodapé sem banco seeded não mostra rótulo órfão. Os ENDEREÇOS vêm
 * do banco em português e não são traduzidos; os RÓTULOS em volta são (ver
 * `footer.contact` nos dicionários).
 */
export async function SiteFooter({ content, brand, locale }: SiteFooterProps) {
  const [{ phone, email, addressMatriz, addressFilial }, socialLinks] =
    await Promise.all([getContactInfo(), getSocialLinks()]);

  const socials = SOCIAL_ORDER.map((key) => ({ key, href: socialLinks[key] }))
    .filter((item): item is { key: SocialKey; href: string } =>
      Boolean(item.href && isSafeHttpUrl(item.href))
    );

  const phoneDigits = phone.replace(/\D/g, "");

  return (
    <footer className="relative border-t border-white/10 bg-[#05070b] px-6 py-14">
      <div className="mx-auto flex max-w-7xl flex-col gap-12">
        {/* BANDA 1 — marca + navegação.
            A marca ocupa a linha inteira em `sm` (col-span-2) porque ali ela
            divide espaço com apenas UMA coluna de links, e sobraria o mesmo
            buraco de antes; em `lg` volta a ser 1 de 4. */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
            <Link href={`/${locale}`} aria-label={brand} className="w-fit">
              <Image
                src={LOGO}
                alt={brand}
                // Dimensões INTRÍNSECAS do arquivo (306×133) — mesma correção
                // já aplicada no `SiteHeader`. Declaradas como 220×90, a razão
                // errada fazia o navegador reservar 88px de largura e encolher
                // para 82,9px ao decodificar o PNG.
                width={306}
                height={133}
                priority={false}
                className="h-9 w-auto"
              />
            </Link>
            <p className={PROSE_BLOCK}>{content.tagline}</p>
          </div>

          {content.columns.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <h3 className={GROUP_TITLE}>{column.title}</h3>
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

        {/* BANDA 2 — contato. Cada unidade ganhou RÓTULO: a descrição da
            filial era um parágrafo solto logo abaixo do endereço da matriz e
            lia como continuação dele (ou como erro). */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-8 border-t border-white/10 pt-8 sm:grid-cols-2 lg:grid-cols-4">
          {(phone || email) && (
            <div className="flex flex-col gap-3">
              <h3 className={GROUP_TITLE}>{content.contact.title}</h3>
              {phone && (
                // O destino é o WhatsApp, e o NOME ACESSÍVEL precisa dizer
                // isso. Até 2026-08-30 este link tinha ícone `Phone` do lucide
                // (marcado `aria-hidden`) e como nome só o número formatado —
                // enquanto o bloco de redes, logo ao lado, aponta para o MESMO
                // href com o nome "ROCO no WhatsApp". Dois links de destino
                // idêntico e rótulos diferentes violam 3.2.4 (Identificação
                // Consistente), e um link chamado "(47) 3335-2012" que abre
                // aba nova em web.whatsapp.com não tem o propósito
                // determinável pelo nome (2.4.4). O número do banco é um
                // canal de WhatsApp (ver `contact.phone` em `src/db/seed.ts`),
                // não uma linha de voz — por isso NÃO é `tel:`.
                <a
                  href={`https://wa.me/${phoneDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${content.socialNames.whatsapp}: ${formatPhoneDisplayBR(phone)}`}
                  className="flex items-center gap-2 text-meta text-white/60 transition hover:text-neon-amber-bright"
                >
                  <WhatsappIcon className="size-4 shrink-0" />
                  {/* O banco guarda o número no formato do link do WhatsApp
                      ("554733352012"), que saía cru na página. */}
                  {formatPhoneDisplayBR(phone)}
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-2 text-meta text-white/60 transition hover:text-neon-amber-bright"
                >
                  <Mail className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 break-words">{email}</span>
                </a>
              )}
            </div>
          )}

          {addressMatriz && (
            <div className="flex flex-col gap-3">
              <h3 className={GROUP_TITLE}>{content.contact.headquartersLabel}</h3>
              {/* Sem ícone: o rótulo acima já diz o que é, e o `MapPin`
                  anterior comia 24px da medida do endereço mais longo. */}
              <p className={PROSE_BLOCK}>
                {addressMatriz}
              </p>
            </div>
          )}

          {addressFilial && (
            <div className="flex flex-col gap-3">
              <h3 className={GROUP_TITLE}>{content.contact.plantLabel}</h3>
              <p className={PROSE_BLOCK}>
                {addressFilial}
              </p>
            </div>
          )}

          {socials.length > 0 && (
            <div className="flex flex-col gap-3">
              {/* `footer.socialLabel` existia nos dois dicionários desde a
                  criação do rodapé e nunca havia sido usado. */}
              <h3 className={GROUP_TITLE}>{content.socialLabel}</h3>
              <ul className="flex flex-wrap items-center gap-3">
                {socials.map(({ key, href }) => (
                  <li key={key}>
                    <SocialLink href={href} label={content.socialNames[key]}>
                      {renderSocialIcon(key)}
                    </SocialLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Certificações e selos da empresa. O selo GPTW é a ARTE OFICIAL com
            vigência (fev 2026 – fev 2027), fornecida pelo stakeholder em
            2026-08-23 e processada para PNG transparente (fundo claro
            removido; original de referência em docs/). Itens sem `image`
            caem no ícone genérico. O array nos dicionários
            (`footer.certifications.items`) comporta selos adicionais. */}
        <div className="flex flex-col gap-3 border-t border-white/10 pt-6">
          {/* Era `text-white/40` = 3,73:1 sobre `#05070b`, abaixo dos 4,5:1 de
              1.4.3 (AA) e sem chegar perto dos 24px que liberariam o limiar de
              3:1. `/60` mede 7,32:1. Mesmo motivo no copyright abaixo. */}
          <h3 className="text-micro uppercase tracking-wide text-white/60">
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
          {/* Teto de medida também aqui: hoje a linha mede 412px a 12px (pt) e
              nunca chega perto de encher o container, mas é a única faixa do
              rodapé de largura total — se a copy legal crescer (CNPJ, endereço
              registral), sem teto ela viraria uma linha de 1280px. */}
          <p className="max-w-3xl text-micro text-white/60">{content.rights}</p>
        </div>
      </div>
    </footer>
  );
}
