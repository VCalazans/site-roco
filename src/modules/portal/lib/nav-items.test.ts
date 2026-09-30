import { describe, expect, it } from "vitest";
import {
  buildPortalNavItems,
  groupPortalNavItems,
  isPortalNavItemActive,
  type PortalNavItem,
} from "./nav-items";
import type { PortalPermissionUser } from "./permissions";

const BASE = "/pt/portal";

const LABELS = {
  dashboard: "Painel",
  onboarding: "Cadastro",
  products: "Produtos",
  representatives: "Representantes",
  welcome: "Boas-vindas",
  hero: "Hero",
  homeContent: "Página inicial",
  leads: "Solicitações",
  materials: "Materiais",
  roles: "Perfis",
  settings: "Configurações",
};

function keysFor(user: PortalPermissionUser) {
  return buildPortalNavItems(BASE, LABELS, user).map((item) => item.key);
}

describe("buildPortalNavItems", () => {
  it("admin vê todos os itens na ordem dos grupos", () => {
    expect(keysFor({ roles: ["admin"], permissions: [] })).toEqual([
      "dashboard",
      "welcome",
      "products",
      "leads",
      "representatives",
      "homeContent",
      "hero",
      "materials",
      "settings",
      "roles",
    ]);
  });

  it("representante vê boas-vindas, materiais e cadastro — sem 'Painel' (redireciona) e sem site/administração", () => {
    expect(
      keysFor({ roles: ["representative"], permissions: ["products:read", "materials:read"] })
    ).toEqual(["welcome", "materials", "onboarding", "products"]);
  });

  it("representante que também é staff continua vendo o Painel", () => {
    expect(keysFor({ roles: ["representative", "sales_manager"], permissions: [] })).toContain("dashboard");
  });

  it("libera 'Página inicial' e 'Solicitações' só com as permissões novas", () => {
    expect(keysFor({ roles: [], permissions: [] })).toEqual(["dashboard"]);
    expect(keysFor({ roles: [], permissions: ["home_content:read"] })).toContain("homeContent");
    expect(keysFor({ roles: [], permissions: ["leads:read"] })).toContain("leads");
    // `update` sozinho não abre a tela: quem edita precisa ao menos ler.
    expect(keysFor({ roles: [], permissions: ["home_content:update"] })).not.toContain("homeContent");
  });

  it("aponta cada item para a rota certa", () => {
    const items = buildPortalNavItems(BASE, LABELS, { roles: ["admin"], permissions: [] });
    const hrefOf = (key: string) => items.find((item) => item.key === key)?.href;
    expect(hrefOf("dashboard")).toBe(BASE);
    expect(hrefOf("homeContent")).toBe(`${BASE}/pagina-inicial`);
    expect(hrefOf("leads")).toBe(`${BASE}/solicitacoes`);
    expect(hrefOf("products")).toBe(`${BASE}/produtos`);
  });

  it("'materiais': biblioteca para quem só lê, gestão para quem cria — mesmo endereço, um item só", () => {
    const reader = buildPortalNavItems(BASE, LABELS, { roles: ["representative"], permissions: ["materials:read"] });
    const readerItem = reader.find((item) => item.key === "materials");
    expect(readerItem).toMatchObject({ href: `${BASE}/materiais`, group: "overview" });

    const manager = buildPortalNavItems(BASE, LABELS, { roles: [], permissions: ["materials:create", "materials:read"] });
    expect(manager.filter((item) => item.key === "materials")).toEqual([
      expect.objectContaining({ href: `${BASE}/materiais`, group: "site" }),
    ]);

    expect(keysFor({ roles: [], permissions: [] })).not.toContain("materials");
  });
});

describe("groupPortalNavItems", () => {
  it("agrupa na ordem fixa e omite grupos vazios", () => {
    const items = buildPortalNavItems(BASE, LABELS, {
      roles: [],
      permissions: ["products:read", "leads:read"],
    });
    expect(groupPortalNavItems(items).map((group) => [group.key, group.items.map((i) => i.key)])).toEqual([
      ["overview", ["dashboard"]],
      ["catalog", ["products"]],
      ["relationship", ["leads"]],
    ]);
  });

  it("agrupa o site e a administração para o admin", () => {
    const groups = groupPortalNavItems(
      buildPortalNavItems(BASE, LABELS, { roles: ["admin"], permissions: [] })
    );
    expect(groups.map((group) => group.key)).toEqual([
      "overview",
      "catalog",
      "relationship",
      "site",
      "admin",
    ]);
    expect(groups.find((group) => group.key === "site")?.items.map((i) => i.key)).toEqual([
      "homeContent",
      "hero",
      "materials",
      "settings",
    ]);
  });
});

describe("isPortalNavItemActive", () => {
  const dashboard: PortalNavItem = { key: "dashboard", label: "", href: BASE, group: "overview" };
  const products: PortalNavItem = {
    key: "products",
    label: "",
    href: `${BASE}/produtos`,
    group: "catalog",
  };

  it("o painel só é ativo na rota exata", () => {
    expect(isPortalNavItemActive(BASE, dashboard)).toBe(true);
    expect(isPortalNavItemActive(`${BASE}/`, dashboard)).toBe(true);
    expect(isPortalNavItemActive(`${BASE}/produtos`, dashboard)).toBe(false);
  });

  it("os demais itens são ativos na rota e nas subrotas", () => {
    expect(isPortalNavItemActive(`${BASE}/produtos`, products)).toBe(true);
    expect(isPortalNavItemActive(`${BASE}/produtos/`, products)).toBe(true);
    expect(isPortalNavItemActive(`${BASE}/produtos/123`, products)).toBe(true);
  });

  it("não confunde rotas que só compartilham o prefixo textual", () => {
    expect(isPortalNavItemActive(`${BASE}/produtos-arquivados`, products)).toBe(false);
    expect(isPortalNavItemActive(`${BASE}/representantes`, products)).toBe(false);
  });

  it("sem pathname nenhum item é ativo", () => {
    expect(isPortalNavItemActive(null, products)).toBe(false);
    expect(isPortalNavItemActive(undefined, dashboard)).toBe(false);
  });
});
