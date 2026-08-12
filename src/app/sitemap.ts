import type { MetadataRoute } from "next";
import { CATALOG_SEGMENT, PRODUCTS_SEGMENT, REPRESENTATIVES_SEGMENT } from "@/core/config/site";
import { locales } from "@/i18n/config";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://roco.com.br";

// Nota: NÃO enumerar uma entrada por produto (`/produtos/[slug]`) — o catálogo
// tem 700+ itens e muda com frequência via sync ERP; decisão já registrada em
// decisionLog (evitar sitemap gigante e desatualizado).
export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap((locale) => {
    const priority = locale === "pt" ? 1 : 0.8;
    return [
      {
        url: `${siteUrl}/${locale}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority,
      },
      {
        url: `${siteUrl}/${locale}/${PRODUCTS_SEGMENT}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: priority * 0.9,
      },
      {
        url: `${siteUrl}/${locale}/${CATALOG_SEGMENT}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: priority * 0.9,
      },
      {
        url: `${siteUrl}/${locale}/${REPRESENTATIVES_SEGMENT}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: priority * 0.8,
      },
    ];
  });
}
