import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { ResolvedHomeContent } from "@/modules/home/lib/home-content";
import type { PublicProductItem } from "@/modules/products/lib/types";
import { Carousel } from "@/shared/components/carousel/carousel";
import { ProductCard, type ProductCardContent } from "@/shared/components/product-card";
import { externalProps } from "@/shared/lib/nav";

type HomeFeaturedProps = {
  content: ResolvedHomeContent["featured"];
  items: PublicProductItem[];
  locale: Locale;
  ctaHref: string;
  cardContent: ProductCardContent;
  badgeLabels: Dictionary["products"]["badges"];
  cartLabels: Dictionary["cart"]["addButton"];
  carouselLabels: { prev: string; next: string };
};

/**
 * Vitrine "Produtos em destaque" (spec 001, RF06/RF12): os produtos marcados
 * como DESTAQUE no painel, na ordem definida pelo operador (sem destaques →
 * campeões de vendas → mais recentes, ver `getFeaturedProducts`). Carrossel
 * com setas e arraste — 4 cards visíveis no desktop, 2 no tablet e ~1,3 no
 * celular (o "pedaço" do próximo card indica que há mais para o lado).
 */
export function HomeFeatured({
  content,
  items,
  locale,
  ctaHref,
  cardContent,
  badgeLabels,
  cartLabels,
  carouselLabels,
}: HomeFeaturedProps) {
  return (
    <section className="relative px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-glow-cyan text-meta font-semibold uppercase tracking-[0.2em] text-neon-cyan-bright">
              {content.eyebrow}
            </p>
            <h2 className="mt-3 font-display text-h1 text-white">{content.headline}</h2>
            <p className="mt-3 text-body text-white/70">{content.description}</p>
          </div>
          <Link href={ctaHref} {...externalProps(ctaHref)} className="btn-neon shrink-0">
            {content.cta.label}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        {items.length === 0 ? (
          <p className="mt-10 text-body text-white/60">{content.emptyState}</p>
        ) : (
          <Carousel
            className="mt-10"
            labels={carouselLabels}
            ariaLabel={content.headline}
            itemClassName="w-[76%] sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)] xl:w-[calc(25%-12px)]"
          >
            {items.map((item, index) => (
              <ProductCard
                key={item.slug}
                item={item}
                locale={locale}
                href={`/${locale}/produtos/${item.slug}`}
                content={cardContent}
                badgeLabels={badgeLabels}
                cartLabels={cartLabels}
                priority={index < 2}
                morphImage
              />
            ))}
          </Carousel>
        )}
      </div>
    </section>
  );
}
