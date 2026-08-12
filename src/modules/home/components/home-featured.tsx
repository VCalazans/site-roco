import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { PublicProductItem } from "@/modules/products/lib/types";
import { ProductCard } from "@/shared/components/product-card";

type HomeFeaturedContent = Dictionary["home"]["featured"];

type HomeFeaturedProps = {
  content: HomeFeaturedContent;
  items: PublicProductItem[];
  locale: Locale;
  ctaHref: string;
  cardContent: Dictionary["products"]["card"];
  badgeLabels: Dictionary["products"]["badges"];
};

export function HomeFeatured({
  content,
  items,
  locale,
  ctaHref,
  cardContent,
  badgeLabels,
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
          <Link href={ctaHref} className="btn-neon shrink-0">
            {content.cta.label}
          </Link>
        </div>

        {items.length === 0 ? (
          <p className="mt-10 text-body text-white/60">{content.emptyState}</p>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item, index) => (
              <ProductCard
                key={item.slug}
                item={item}
                locale={locale}
                href={`/${locale}/produtos/${item.slug}`}
                content={cardContent}
                badgeLabels={badgeLabels}
                priority={index < 2}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
