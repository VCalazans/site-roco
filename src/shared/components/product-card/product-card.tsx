import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { PublicProductItem } from "@/modules/products/lib/types";
import { AddToCartButton, type AddToCartLabels } from "@/shared/components/cart";

export type ProductCardContent = {
  viewDetails: string;
  codeLabel: string;
};

type ProductCardProps = {
  item: PublicProductItem;
  locale: Locale;
  href: string;
  content: ProductCardContent;
  /**
   * `dictionary.products.badges` — typed against the exact dictionary shape
   * (not `Record<string, string>`) so passing it through doesn't require an
   * explicit index signature; the lookup below casts the dynamic `badge` key
   * at the point of use instead.
   */
  badgeLabels: Dictionary["products"]["badges"];
  /** `dictionary.cart.addButton` — every current call site passes it (home
   *  featured, listing, related products), but it stays optional so the
   *  card keeps rendering (without the button) if a future caller forgets. */
  cartLabels?: AddToCartLabels;
  priority?: boolean;
};

/**
 * Card de produto compartilhado entre a home (destaques) e o catálogo
 * (listagem + relacionados) — mora em `shared/` porque mais de um módulo o
 * renderiza (ver `systemPatterns.md`).
 *
 * O card inteiro continua clicável via `<Link>`, mas o botão "adicionar ao
 * carrinho" (`AddToCartButton`, Client Component) NÃO fica dentro dele:
 * `<button>` aninhado em `<a>` é HTML inválido e dispararia os dois cliques
 * (navegar + adicionar) ao mesmo tempo. Em vez disso, o `<Link>` e o botão
 * são IRMÃOS dentro de um contêiner `relative` — o botão flutua sobre a
 * imagem via posicionamento absoluto, sem tocar a árvore do link.
 */
export function ProductCard({ item, locale, href, content, badgeLabels, cartLabels, priority }: ProductCardProps) {
  const name = locale === "en" && item.nameEn ? item.nameEn : item.namePt;
  const primaryCategory = item.categories[0];
  const primaryCategoryName =
    primaryCategory && locale === "en" && primaryCategory.nameEn
      ? primaryCategory.nameEn
      : primaryCategory?.namePt;
  const cover = item.images[0];
  const coverAlt =
    (locale === "en" ? cover?.altEn ?? cover?.altPt : cover?.altPt ?? cover?.altEn) || name;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-neon-cyan/50 hover:bg-white/[0.05] hover:shadow-[0_0_30px_rgba(53,217,255,0.15)]">
      <Link href={href} className="flex h-full flex-col">
        <div className="relative aspect-square w-full overflow-hidden bg-[#0a0f16]">
          {cover ? (
            <Image
              src={cover.url}
              alt={coverAlt}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 22vw, (min-width: 640px) 40vw, 90vw"
              className="object-contain p-4 transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/15">
              <Package className="size-12" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-4">
          {primaryCategoryName ? (
            <span className="text-micro font-semibold uppercase tracking-wide text-neon-amber-bright">
              {primaryCategoryName}
            </span>
          ) : null}
          <h3 className="line-clamp-2 text-ui font-semibold text-white">{name}</h3>
          <p className="text-micro text-white/50">
            {content.codeLabel} {item.sku}
          </p>

          {item.badges.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {item.badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-neon-cyan/30 px-2 py-0.5 text-micro text-neon-cyan-bright"
                >
                  {badgeLabels[badge as keyof typeof badgeLabels] ?? badge}
                </span>
              ))}
            </div>
          ) : null}

          <span className="mt-auto inline-flex items-center gap-1 pt-3 text-micro font-semibold text-neon-cyan-bright">
            {content.viewDetails}
            <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </Link>

      {cartLabels ? (
        <div className="absolute right-3 top-3 z-10">
          <AddToCartButton slug={item.slug} name={name} sku={item.sku} locale={locale} labels={cartLabels} />
        </div>
      ) : null}
    </div>
  );
}
