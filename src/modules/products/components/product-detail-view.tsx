import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Layers, Package, Shapes, ShoppingBag, type LucideIcon } from "lucide-react";
import { productsPath } from "@/core/config/site";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { PublicProductItem } from "@/modules/products/lib/types";
import { AdjacentProducts } from "@/modules/products/components/adjacent-products";
import { BackToListing } from "@/modules/products/components/back-to-listing";
import { ProductGallery } from "@/modules/products/components/product-gallery";
import { QuoteCtaButton } from "@/modules/products/components/quote-cta-button";
import { AddToCartButton } from "@/shared/components/cart";
import { Carousel } from "@/shared/components/carousel/carousel";
import { BestSellerBadge, ProductCard, productImageTransitionName } from "@/shared/components/product-card";
import { describePackaging } from "@/shared/lib/packaging";

/** Ícone por tipo de embalagem (decorativo — o título já diz o tipo). */
const PACKAGING_ICONS: Record<string, LucideIcon> = {
  peca: Shapes,
  blister: Layers,
  saco_plastico: ShoppingBag,
  caixa: Package,
};

/**
 * Cena decorativa extraída de `docs/Layout pag Produtos_INDIVIDUAL_OK.psd`
 * (moldura losangular neon à direita — ver `docs/produtos-individual-preview.png`),
 * como fundo em opacidade reduzida atrás da galeria.
 */
const SCENE = "/images/produtos/individual-scene.jpg";

type ProductDetailViewProps = {
  product: PublicProductItem;
  related: PublicProductItem[];
  adjacent: { previous: PublicProductItem | null; next: PublicProductItem | null };
  locale: Locale;
  products: Dictionary["products"];
  cart: Dictionary["cart"];
  relatedCarouselLabels: { prev: string; next: string };
};

/**
 * Detalhe do produto (spec 001): breadcrumb com a categoria, "voltar aos
 * produtos" que restaura a listagem como estava, galeria interativa (setas,
 * miniaturas, teclado, arraste), selo de campeão de vendas, CTAs claros
 * ("Adicionar ao orçamento" + "Solicitar orçamento agora"), produto
 * anterior/próximo da categoria e relacionados em carrossel.
 *
 * O header vive no layout `(site)` desde a spec 001.
 */
export function ProductDetailView({
  product,
  related,
  adjacent,
  locale,
  products,
  cart,
  relatedCarouselLabels,
}: ProductDetailViewProps) {
  const { detail } = products;
  const name = locale === "en" && product.nameEn ? product.nameEn : product.namePt;
  const description = locale === "en" ? product.descriptionEn : product.descriptionPt;
  const primaryCategory = product.categories[0];
  const categoryLabel = (category: { namePt: string; nameEn: string | null }) =>
    (locale === "en" && category.nameEn ? category.nameEn : category.namePt).replace(/_/g, " ");
  const galleryImages = product.images.map((image) => ({
    url: image.url,
    alt: (locale === "en" ? image.altEn ?? image.altPt : image.altPt ?? image.altEn) || name,
  }));
  const listingHref = productsPath(locale);

  return (
    <div className="relative min-h-[100svh] w-full bg-[#05070b]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[40rem] overflow-hidden">
        <Image src={SCENE} alt="" fill priority sizes="100vw" className="object-cover object-right opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05070b]/10 via-[#05070b]/60 to-[#05070b]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05070b] via-[#05070b]/50 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-5 pb-20 pt-24 sm:px-6 md:pt-32">
        {/* Voltar + breadcrumb (Home › Produtos › Categoria › Produto). */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BackToListing locale={locale} fallbackHref={listingHref} label={detail.back} />
          <nav aria-label={detail.breadcrumbLabel}>
            <ol className="flex flex-wrap items-center gap-1.5 text-meta text-white/60">
              <li>
                <Link href={`/${locale}`} className="transition hover:text-white">
                  {detail.breadcrumbHome}
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="size-3.5 text-white/35" />
              </li>
              <li>
                <Link href={listingHref} className="transition hover:text-white">
                  {detail.breadcrumbProducts}
                </Link>
              </li>
              {primaryCategory ? (
                <>
                  <li aria-hidden>
                    <ChevronRight className="size-3.5 text-white/35" />
                  </li>
                  <li>
                    <Link
                      href={`${listingHref}?category=${encodeURIComponent(primaryCategory.slug)}`}
                      className="uppercase tracking-wide transition hover:text-white"
                    >
                      {categoryLabel(primaryCategory)}
                    </Link>
                  </li>
                </>
              ) : null}
              <li aria-hidden>
                <ChevronRight className="size-3.5 text-white/35" />
              </li>
              <li aria-current="page" className="max-w-[16rem] truncate text-white/90">
                {name}
              </li>
            </ol>
          </nav>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <ProductGallery
            images={galleryImages}
            labels={detail.gallery}
            transitionName={productImageTransitionName(product.slug)}
            overlay={product.bestSeller ? <BestSellerBadge label={detail.bestSeller} shortLabel={products.card.bestSellerShort} /> : undefined}
          />

          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              {product.categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`${listingHref}?category=${encodeURIComponent(category.slug)}`}
                  className="rounded-full border border-neon-amber/30 px-3 py-1 text-micro font-semibold uppercase tracking-wide text-neon-amber-bright transition hover:border-neon-amber hover:bg-neon-amber/10"
                >
                  {categoryLabel(category)}
                </Link>
              ))}
            </div>

            <div>
              <h1 className="text-glow-soft font-display text-h1 text-white">{name}</h1>
              <p className="mt-2 text-meta text-white/60">
                {detail.codeLabel}: <span className="text-white/90">{product.sku}</span>
              </p>
            </div>

            {product.bestSeller ? (
              <div className="flex flex-wrap items-center gap-3">
                <BestSellerBadge label={detail.bestSeller} variant="detail" />
                <p className="text-meta text-white/65">{detail.bestSellerNote}</p>
              </div>
            ) : null}

            {product.badges.length > 0 ? (
              <div>
                <h2 className="mb-2 text-ui font-semibold text-white/80">{detail.badgesHeadline}</h2>
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
              </div>
            ) : null}

            {description ? (
              <div>
                <h2 className="mb-2 text-ui font-semibold text-white/80">{detail.descriptionHeadline}</h2>
                <p className="whitespace-pre-line text-body text-white/75">{description}</p>
              </div>
            ) : null}

            <div>
              <h2 className="mb-1 flex items-center gap-2 text-ui font-semibold text-white/80">
                {detail.packagingsHeadline}
                {product.packagings.length > 0 ? (
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-micro font-medium text-white/60">
                    {product.packagings.length}
                  </span>
                ) : null}
              </h2>
              {product.packagings.length > 0 ? (
                <>
                  <p className="mb-3 text-meta text-white/55">{detail.packagingsNote}</p>
                  {/* TODAS as embalagens cadastradas, na ordem de `sortPackagings`
                      (já aplicada no servidor) e sem destaque de "padrão": a
                      embalagem pode ser composta e nenhuma é a principal. */}
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {product.packagings.map((packaging) => {
                      const { title, detail: packagingDetail } = describePackaging(packaging, products.packagingInfo);
                      const Icon = PACKAGING_ICONS[packaging.packagingType] ?? Package;
                      return (
                        <li
                          key={`${packaging.packagingType}-${packaging.unitsPerPack}`}
                          className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5"
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan-bright">
                            <Icon className="size-5" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <p className="text-ui font-semibold text-white">{title}</p>
                            <p className="text-meta text-white/70">{packagingDetail}</p>
                            {packaging.barcodeEan13 ? (
                              <p className="mt-1 break-all font-mono text-micro text-white/50">
                                {products.packagingInfo.ean} {packaging.barcodeEan13}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="text-meta text-white/50">{detail.noPackagings}</p>
              )}
            </div>

            {/* Bloco de ação: "Adicionar ao orçamento" (lista multi-produto) é
                o caminho principal; "Solicitar orçamento agora" leva ao
                formulário já com este produto, para quem quer só este item. */}
            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-meta text-white/70">{detail.quoteHint}</p>
              <div className="flex flex-wrap items-center gap-3">
                <AddToCartButton
                  slug={product.slug}
                  name={name}
                  sku={product.sku}
                  image={product.images[0]?.url}
                  locale={locale}
                  labels={cart.addButton}
                  variant="detail"
                />
                <QuoteCtaButton label={detail.quoteCta} locale={locale} productSlug={product.slug} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14">
          <AdjacentProducts
            previous={adjacent.previous}
            next={adjacent.next}
            locale={locale}
            labels={{
              previousProduct: detail.previousProduct,
              nextProduct: detail.nextProduct,
              adjacentLabel: detail.adjacentLabel,
            }}
          />
        </div>

        <section className="mt-16">
          <h2 className="mb-6 font-display text-h2 text-white">{detail.relatedHeadline}</h2>
          {related.length > 0 ? (
            <Carousel
              labels={relatedCarouselLabels}
              ariaLabel={detail.relatedHeadline}
              itemClassName="w-[76%] sm:w-[calc(50%-8px)] lg:w-[calc(25%-12px)]"
            >
              {related.map((item) => (
                <ProductCard
                  key={item.slug}
                  item={item}
                  locale={locale}
                  href={`/${locale}/produtos/${item.slug}`}
                  content={products.card}
                  badgeLabels={products.badges}
                  cartLabels={cart.addButton}
                />
              ))}
            </Carousel>
          ) : (
            <p className="text-meta text-white/50">{detail.noRelated}</p>
          )}
        </section>
      </div>
    </div>
  );
}
