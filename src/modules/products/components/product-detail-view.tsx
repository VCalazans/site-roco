import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { PublicProductItem } from "@/modules/products/lib/types";
import { QuoteCtaButton } from "@/modules/products/components/quote-cta-button";
import { SiteHeader } from "@/shared/components/nav";
import type { NavLink } from "@/shared/lib/nav";
import { ProductCard } from "@/shared/components/product-card";

/**
 * Cena decorativa extraída de `docs/Layout pag Produtos_INDIVIDUAL_OK.psd`
 * (nav + moldura losangular neon à direita — ver preview em
 * `docs/produtos-individual-preview.png`). O PSD não trouxe coordenadas
 * medidas para encaixar a foto real do produto dentro do losango (só a hero
 * da home teve esse trabalho de extração feito); em vez de aproximar um
 * recorte pixel-a-pixel sem medidas confiáveis, a cena entra como fundo
 * decorativo em opacidade reduzida atrás de um card de galeria comum — fiel
 * ao clima do PSD sem fingir um alinhamento que não foi medido.
 */
const SCENE = "/images/produtos/individual-scene.jpg";

type ProductDetailViewProps = {
  product: PublicProductItem;
  related: PublicProductItem[];
  locale: Locale;
  navigation: Dictionary["navigation"];
  products: Dictionary["products"];
  navLinks: NavLink[];
};

export function ProductDetailView({
  product,
  related,
  locale,
  navigation,
  products,
  navLinks,
}: ProductDetailViewProps) {
  const name = locale === "en" && product.nameEn ? product.nameEn : product.namePt;
  const description = locale === "en" ? product.descriptionEn : product.descriptionPt;
  const cover = product.images[0];
  const gallery = product.images.slice(1, 5);
  const imageAlt = (image: { altPt: string | null; altEn: string | null }) =>
    (locale === "en" ? image.altEn ?? image.altPt : image.altPt ?? image.altEn) || name;

  return (
    <div className="relative min-h-[100svh] w-full bg-[#05070b]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[40rem] overflow-hidden">
        <Image
          src={SCENE}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-right opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05070b]/10 via-[#05070b]/60 to-[#05070b]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05070b] via-[#05070b]/50 to-transparent" />
      </div>

      <SiteHeader
        brand={navigation.brand}
        links={navLinks}
        menuLabels={{ open: navigation.menu, close: navigation.close }}
      />

      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-20 pt-24 sm:px-6 md:pt-32">
        {/* Breadcrumb */}
        <nav aria-label={products.detail.breadcrumbProducts} className="mb-8 flex flex-wrap items-center gap-2 text-meta text-white/60">
          <Link href={`/${locale}`} className="transition hover:text-white">
            {products.detail.breadcrumbHome}
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/${locale}/produtos`} className="transition hover:text-white">
            {products.detail.breadcrumbProducts}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-white/90">{name}</span>
        </nav>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Gallery */}
          <div>
            <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0a0f16] shadow-[0_0_60px_-20px_rgba(53,217,255,0.35)]">
              {cover ? (
                <Image
                  src={cover.url}
                  alt={imageAlt(cover)}
                  fill
                  priority
                  sizes="(min-width: 1024px) 45vw, 90vw"
                  className="object-contain p-8"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white/15">
                  <Package className="size-24" aria-hidden />
                </div>
              )}
            </div>

            {gallery.length > 0 ? (
              <div className="mt-4 grid grid-cols-4 gap-3">
                {gallery.map((image, index) => (
                  <div
                    key={`${image.url}-${index}`}
                    className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-[#0a0f16]"
                  >
                    <Image
                      src={image.url}
                      alt={imageAlt(image)}
                      fill
                      sizes="120px"
                      className="object-contain p-2"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-6">
            {product.categories.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {product.categories.map((cat) => (
                  <span
                    key={cat.slug}
                    className="rounded-full border border-neon-amber/30 px-3 py-1 text-micro font-semibold uppercase tracking-wide text-neon-amber-bright"
                  >
                    {locale === "en" && cat.nameEn ? cat.nameEn : cat.namePt}
                  </span>
                ))}
              </div>
            ) : null}

            <div>
              <h1 className="text-glow-soft font-display text-h1 text-white">{name}</h1>
              <p className="mt-2 text-meta text-white/60">
                {products.detail.codeLabel}: <span className="text-white/90">{product.sku}</span>
              </p>
            </div>

            <div>
              <h2 className="mb-2 text-ui font-semibold text-white/80">{products.detail.badgesHeadline}</h2>
              {product.badges.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {product.badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-neon-cyan/30 px-3 py-1 text-micro text-neon-cyan-bright"
                    >
                      {products.badges[badge as keyof typeof products.badges] ?? badge}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-meta text-white/50">{products.detail.noBadges}</p>
              )}
            </div>

            {description ? (
              <div>
                <h2 className="mb-2 text-ui font-semibold text-white/80">{products.detail.descriptionHeadline}</h2>
                <p className="whitespace-pre-line text-body text-white/75">{description}</p>
              </div>
            ) : null}

            <div>
              <h2 className="mb-2 text-ui font-semibold text-white/80">{products.detail.packagingsHeadline}</h2>
              {product.packagings.length > 0 ? (
                <ul className="flex flex-col gap-2 text-body text-white/75">
                  {product.packagings.map((packaging, index) => (
                    <li key={index} className="flex items-center gap-2.5">
                      <span className="size-1.5 shrink-0 rounded-full bg-neon-cyan-bright" aria-hidden />
                      <span>
                        {products.packaging[packaging.packagingType as keyof typeof products.packaging] ??
                          packaging.packagingType}{" "}
                        — {packaging.unitsPerPack}
                      </span>
                      {packaging.isDefault ? (
                        <span className="text-micro font-semibold text-neon-amber-bright">•</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-meta text-white/50">{products.detail.noPackagings}</p>
              )}
            </div>

            <QuoteCtaButton label={products.detail.quoteCta} locale={locale} productSlug={product.slug} />
          </div>
        </div>

        {/* Related */}
        <section className="mt-20">
          <h2 className="mb-6 font-display text-h2 text-white">{products.detail.relatedHeadline}</h2>
          {related.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-4">
              {related.map((item) => (
                <ProductCard
                  key={item.slug}
                  item={item}
                  locale={locale}
                  href={`/${locale}/produtos/${item.slug}`}
                  content={products.card}
                  badgeLabels={products.badges}
                />
              ))}
            </div>
          ) : (
            <p className="text-meta text-white/50">{products.detail.noRelated}</p>
          )}
        </section>
      </main>
    </div>
  );
}
