import Link from "next/link";
import type { Dictionary } from "@/i18n/get-dictionary";

type HomePortalCtaContent = Dictionary["home"]["portalCta"];

type HomePortalCtaProps = {
  content: HomePortalCtaContent;
  ctaHref: string;
};

/** Banda de CTA para o Portal ROCO (pré-cadastro de representantes). */
export function HomePortalCta({ content, ctaHref }: HomePortalCtaProps) {
  return (
    <section className="relative overflow-hidden px-6 py-20 sm:py-24">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 size-[28rem] rounded-full bg-neon-cyan/10 blur-[140px]" />
        <div className="absolute -right-32 bottom-0 size-[28rem] rounded-full bg-neon-amber/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-5 rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center sm:px-12">
        <h2 className="font-display text-h1 text-white">{content.headline}</h2>
        <p className="max-w-2xl text-body text-white/70">{content.description}</p>
        <Link href={ctaHref} className="btn-neon-grad mt-2">
          {content.cta.label}
        </Link>
      </div>
    </section>
  );
}
