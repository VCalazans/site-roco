/**
 * Render (SSR) do formulário de produto. O `Dialog` do MUI monta o conteúdo num
 * Portal, que o `renderToString` não renderiza — então aqui ele é trocado por um
 * contêiner simples e o teste enxerga só o conteúdo do formulário. Cobre o que o
 * `tsc` não pega: seções e rótulos vindos do dicionário (sem "undefined"), o
 * selo legado `top` fora da lista, a vitrine do site e a hidratação de um
 * produto existente. Interação continua sendo validada no navegador.
 */
import type { ReactElement, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { describe, expect, it, vi } from "vitest";
import { createPortalTheme } from "@/core/theme";
import { TRPCProvider } from "@/core/trpc-client";
import type { Locale } from "@/i18n/config";
import en from "@/i18n/dictionaries/en.json";
import pt from "@/i18n/dictionaries/pt.json";
import type { AppRouter } from "@/server/trpc/routers/_app";
import type { PortalPermissionUser } from "@/modules/portal/lib/permissions";
import type { ProductDetail } from "@/modules/portal/lib/product-types";
import type { PortalDictionary } from "@/modules/portal/lib/types";

vi.mock("@mui/material/Dialog", () => ({
  default: ({ children }: { children: ReactNode }) => <div data-testid="dialog">{children}</div>,
}));

import { ProductFormDialog } from "./product-form-dialog";

const PORTALS = { pt: pt.portal as unknown as PortalDictionary, en: en.portal as unknown as PortalDictionary };
const ADMIN: PortalPermissionUser = { roles: ["admin"], permissions: [] };
const EDITOR_WITHOUT_PUBLISH: PortalPermissionUser = {
  roles: [],
  permissions: ["products:read", "products:create", "products:update"],
};

const CATEGORIES = [
  { id: "c1", namePt: "Hidrossanitários", nameEn: "Plumbing" },
  { id: "c2", namePt: "Reparos", nameEn: "Repairs" },
];

const PRODUCT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const detail: ProductDetail = {
  id: PRODUCT_ID,
  sku: "1122",
  slug: "valvula-de-descarga",
  erpCode: "ERP-77",
  namePt: "Válvula de Descarga",
  nameEn: "Flush Valve",
  descriptionPt: "Descrição em português",
  descriptionEn: null,
  ncm: "39174090",
  barcodeEan13: "7891234567895",
  published: true,
  active: true,
  featured: true,
  featuredOrder: 3,
  bestSeller: true,
  categories: [
    { id: "c1", isPrimary: true },
    { id: "c2", isPrimary: false },
  ],
  badges: ["nacional", "seguro"],
  packagings: [
    { id: "k1", packagingType: "caixa", unitsPerPack: 12, isDefault: true, erpComplementCode: "0002" },
  ],
  images: [],
};

function render(node: ReactElement, locale: Locale, queryClient: QueryClient): string {
  const trpcClient = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "http://localhost/api/trpc" })],
  });
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <ThemeProvider theme={createPortalTheme(locale)}>{node}</ThemeProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );
}

function renderDialog(opts: {
  locale: Locale;
  productId: string | null;
  user?: PortalPermissionUser;
  seedDetail?: boolean;
}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (opts.seedDetail) {
    queryClient.setQueryData([["products", "byId"], { input: { id: PRODUCT_ID }, type: "query" }], detail);
  }
  const portal = PORTALS[opts.locale];
  return render(
    <ProductFormDialog
      open
      onClose={() => {}}
      productId={opts.productId}
      dictionary={portal.products}
      commonDictionary={portal.common}
      errorLabel={portal.errors.generic}
      categories={CATEGORIES}
      user={opts.user ?? ADMIN}
      locale={opts.locale}
    />,
    opts.locale,
    queryClient
  );
}

function noBrokenText(html: string) {
  const markup = html.replace(/<style[\s\S]*?<\/style>/g, "");
  expect(markup).not.toMatch(/undefined|\[object Object\]|NaN/);
  expect(markup).not.toMatch(/\{[a-zA-Z]+\}/);
}

describe.each(["pt", "en"] as const)("formulário de produto (%s)", (locale) => {
  const form = PORTALS[locale].products.form;
  const products = PORTALS[locale].products;

  it("novo produto: seis seções com título e dica, campos obrigatórios e imagens só após salvar", () => {
    const html = renderDialog({ locale, productId: null });
    for (const section of ["identification", "copy", "categories", "showcase", "packaging", "images"] as const) {
      expect(html).toContain(form.sections[section].title);
      expect(html).toContain(form.sections[section].hint);
    }
    expect(html).toContain(form.createTitle);
    expect(html).toContain(form.fields.sku);
    expect(html).toContain(form.fields.name);
    // Campos obrigatórios marcados (asterisco do MUI) e sem erro antes da tentativa de salvar.
    expect((html.match(/<input[^>]*\srequired(?:=""|\s|>)/g) ?? []).length).toBe(2);
    expect(html).not.toContain(form.validation.required);
    // Imagens exigem o produto salvo.
    expect(html).toContain(form.images.saveFirst);
    // Sem link "Ver no site" (nada publicado ainda).
    expect(html).not.toContain(form.actions.viewOnSite);
    noBrokenText(html);
  });

  it("oferece os selos atuais e NÃO o legado 'top' (virou campeão de vendas)", () => {
    const html = renderDialog({ locale, productId: null });
    expect(html).toContain(products.badges.nacional);
    expect(html).toContain(products.badges.universal);
    expect(html).toContain(products.badges.tresEmUm);
    expect(html).toContain(products.badges.seguro);
    expect(html).not.toContain(`>${products.badges.top}<`);
  });

  it("vitrine do site: publicado, destaque e campeão com textos de apoio", () => {
    const html = renderDialog({ locale, productId: null });
    expect(html).toContain(form.fields.published);
    expect(html).toContain(form.fields.publishedHelper);
    expect(html).toContain(form.fields.featured);
    expect(html).toContain(form.fields.featuredHelper);
    expect(html).toContain(form.fields.bestSeller);
    expect(html).toContain(form.fields.bestSellerHelper);
    // A posição só aparece com o destaque ligado.
    expect(html).not.toContain(form.fields.featuredOrder);
  });

  it("embalagens: botão com texto próprio, sem os 'hacks' de rótulo antigos", () => {
    const html = renderDialog({ locale, productId: null });
    expect(html).toContain(form.actions.addPackaging);
  });

  it("editar: hidrata o formulário, mostra a posição da vitrine e o link 'Ver no site'", () => {
    const html = renderDialog({ locale, productId: PRODUCT_ID, seedDetail: true });
    expect(html).toContain(form.editTitle);
    expect(html).toContain('value="1122"');
    expect(html).toContain('value="Válvula de Descarga"');
    expect(html).toContain('value="ERP-77"');
    expect(html).toContain('value="39174090"');
    // Vitrine: destaque ligado revela a posição, com o valor salvo.
    expect(html).toContain(form.fields.featuredOrder);
    expect(html).toContain('value="3"');
    // Categoria principal só aparece com 2+ categorias.
    expect(html).toContain(form.fields.primaryCategory);
    expect(html).toContain(form.fields.primaryCategoryHelper);
    // Embalagem existente — sem controle de "padrão" (não existe embalagem principal).
    expect(html).toContain(form.fields.packagingType);
    expect(html).toContain('value="12"');
    // Publicado no servidor -> link para o site no locale certo.
    expect(html).toContain(form.actions.viewOnSite);
    expect(html).toContain(`href="/${locale}/produtos/valvula-de-descarga"`);
    // Fechar (e não Cancelar) enquanto nada foi alterado.
    expect(html).toContain(form.actions.close);
    noBrokenText(html);
  });

  it("sem products:publish o interruptor de publicação fica desabilitado", () => {
    const withPublish = renderDialog({ locale, productId: null, user: ADMIN });
    const withoutPublish = renderDialog({ locale, productId: null, user: EDITOR_WITHOUT_PUBLISH });
    const disabledSwitches = (html: string) =>
      (html.match(/<input[^>]*type="checkbox"[^>]*role="switch"[^>]*>/g) ?? []).filter((tag) =>
        tag.includes("disabled")
      ).length;
    expect(disabledSwitches(withPublish)).toBe(0);
    expect(disabledSwitches(withoutPublish)).toBe(1);
  });
});
