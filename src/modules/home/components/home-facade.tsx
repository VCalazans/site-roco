import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ResolvedHomeContent } from "@/modules/home/lib/home-content";
import { externalProps } from "@/shared/lib/nav";
import { FacadeParallax } from "./facade-parallax";

type HomeFacadeProps = {
  content: ResolvedHomeContent["facade"];
  /** Destino do CTA já resolvido (`resolveCtaHref`), ou `null` sem CTA. */
  ctaHref: string | null;
};

/**
 * Seção BREVE da fachada da fábrica, logo após o vídeo (spec 001, RF17): uma
 * faixa de imagem com a assinatura "Onde tudo se conecta" que separa o hero do
 * conteúdo institucional. Tudo aqui é editável no painel (imagem, textos PT/EN,
 * CTA) — ver `/portal/pagina-inicial`.
 *
 * A imagem padrão é o recorte do galpão no render oficial do hero (~900px de
 * origem): por isso a faixa tem altura contida e overlays fortes — o operador
 * troca pela foto oficial em alta no painel, sem deploy.
 */
export function HomeFacade({ content, ctaHref }: HomeFacadeProps) {
  return (
    <section id="fachada" className="relative isolate overflow-hidden bg-[#05070b]">
      <FacadeParallax>
        <Image
          src={content.imageUrl}
          alt={content.imageAlt}
          fill
          sizes="100vw"
          className="object-cover object-[30%_center] md:object-center"
        />
      </FacadeParallax>

      {/* Overlays. O galpão com a marca fica no terço ESQUERDO da foto padrão,
          então o texto mora à DIREITA (sobre o pátio) e o escurecimento vem
          da direita — no mobile, o texto desce e o degradê vem de baixo. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[#05070b] via-[#05070b]/70 to-[#05070b]/10 md:bg-gradient-to-l md:via-[#05070b]/70 md:to-transparent"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#05070b]/80 via-transparent to-[#05070b]/90" />
      {/* Filetes dual-tone da marca — mesma linguagem do header. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-neon-cyan/60 via-white/10 to-neon-amber/60" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-neon-cyan/40 via-white/5 to-neon-amber/40" />

      <div className="relative mx-auto flex min-h-[28rem] max-w-7xl items-end px-6 pb-14 pt-40 md:min-h-[32rem] md:items-center md:py-24">
        <div className="max-w-xl md:ml-auto">
          {content.eyebrow ? (
            <p className="text-glow-amber text-meta font-semibold uppercase tracking-[0.2em] text-neon-amber-bright">
              {content.eyebrow}
            </p>
          ) : null}
          <h2 className="text-glow-soft mt-3 font-display text-h1 text-white">{content.headline}</h2>
          {content.text ? <p className="mt-4 text-lede text-white/80">{content.text}</p> : null}
          {content.cta && ctaHref ? (
            <Link href={ctaHref} {...externalProps(ctaHref)} className="btn-neon mt-7 w-fit">
              {content.cta.label}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
