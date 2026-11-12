"use client";

import { useEffect } from "react";
import { trackMeta } from "@/shared/lib/meta-pixel";

/** ViewContent do Pixel ao abrir o detalhe de um produto (só navegador). */
export function MetaViewContent({ sku, name, category }: { sku: string; name: string; category?: string }) {
  useEffect(() => {
    trackMeta("ViewContent", {
      content_ids: [sku],
      content_type: "product",
      content_name: name,
      ...(category ? { content_category: category } : {}),
    });
  }, [sku, name, category]);
  return null;
}
