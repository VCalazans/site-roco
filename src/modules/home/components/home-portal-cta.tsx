import Link from "next/link";
import Image from "next/image";
import type { ResolvedHomeContent } from "@/modules/home/lib/home-content";
import { externalProps } from "@/shared/lib/nav";

type HomePortalCtaProps = {
  content: ResolvedHomeContent["portalCta"];
  ctaHref: string;
  brand: string;
};

/**
 * Banda de CTA para o Portal ROCO (pré-cadastro de representantes). Textos e
 * destino editáveis no painel. A assinatura "onde tudo se conecta" da marca
 * nova fecha a home antes do rodapé.
 */
export function HomePortalCta({ content, ctaHref, brand }: HomePortalCtaProps) {
  return (
    <section className="relative overflow-hidden px-6 py-20 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 size-[28rem] rounded-full bg-neon-cyan/10 blur-[140px]" />
        <div className="absolute -right-32 bottom-0 size-[28rem] rounded-full bg-neon-amber/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-5 rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center shadow-[0_30px_80px_-40px_rgba(53,217,255,0.35)] sm:px-12">
        <Image
          src="/images/logos/roco-logo-white.png"
          alt={brand}
          width={289}
          height={125}
          className="h-9 w-auto opacity-90"
        />
        <h2 className="font-display text-h1 text-white">{content.headline}</h2>
        <p className="max-w-2xl text-body text-white/70">{content.description}</p>
        <Link href={ctaHref} {...externalProps(ctaHref)} className="btn-neon-grad mt-2">
          {content.cta.label}
        </Link>
      </div>
    </section>
  );
}
