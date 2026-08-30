import { describe, expect, it } from "vitest";
import {
  CATALOG_FALLBACK_ORIGIN,
  CATALOG_SUBJECT,
  catalogDownloadLink,
  catalogServerFieldErrors,
  hasCatalogFormErrors,
  resolveCatalogOrigin,
  validateCatalogForm,
  type CatalogFormValues,
} from "@/modules/catalog/lib/catalog-form";
import { CATALOG_PDF_FILENAME } from "@/core/config/site";
import { CONTACT_SUBJECTS, contactSchema } from "@/server/lib/contact-submit";
import { LEAD_ORIGINS } from "@/shared/lib/lead-origin";

const VALID: CatalogFormValues = {
  name: "Maria Silva",
  email: "maria@exemplo.com.br",
  phone: "(47) 99999-8888",
  companyName: "Construtora Exemplo",
};

function values(overrides: Partial<CatalogFormValues> = {}): CatalogFormValues {
  return { ...VALID, ...overrides };
}

describe("validateCatalogForm", () => {
  it("aceita um preenchimento completo e consentido", () => {
    expect(validateCatalogForm(values(), true)).toEqual({});
  });

  it("aceita empresa vazia (campo opcional)", () => {
    expect(validateCatalogForm(values({ companyName: "" }), true)).toEqual({});
  });

  it("exige nome", () => {
    expect(validateCatalogForm(values({ name: "" }), true).name).toBe("required");
  });

  it("trata nome só com espaços como ausente", () => {
    expect(validateCatalogForm(values({ name: "   " }), true).name).toBe("required");
  });

  it("rejeita nome de um caractere (mesmo mínimo do servidor)", () => {
    expect(validateCatalogForm(values({ name: "A" }), true).name).toBe("nameTooShort");
  });

  it("aceita nome com exatamente dois caracteres", () => {
    expect(validateCatalogForm(values({ name: "Jô" }), true).name).toBeUndefined();
  });

  it("exige e-mail", () => {
    expect(validateCatalogForm(values({ email: "" }), true).email).toBe("required");
  });

  it.each(["maria", "maria@", "@exemplo.com", "maria@exemplo", "ma ria@exemplo.com"])(
    "rejeita e-mail inválido: %s",
    (email) => {
      expect(validateCatalogForm(values({ email }), true).email).toBe("invalidEmail");
    }
  );

  it("exige telefone", () => {
    expect(validateCatalogForm(values({ phone: "" }), true).phone).toBe("required");
  });

  it("rejeita telefone fora do formato brasileiro", () => {
    expect(validateCatalogForm(values({ phone: "12345" }), true).phone).toBe("invalidPhone");
  });

  it("exige o consentimento LGPD", () => {
    expect(validateCatalogForm(values(), false).consent).toBe("consentRequired");
  });

  it("acumula todos os erros de uma vez (a pessoa corrige tudo numa passada)", () => {
    expect(validateCatalogForm({ name: "", email: "x", phone: "", companyName: "" }, false)).toEqual({
      name: "required",
      email: "invalidEmail",
      phone: "required",
      consent: "consentRequired",
    });
  });

  it("não inventa erro para campo válido", () => {
    const errors = validateCatalogForm(values({ email: "" }), true);
    expect(errors.name).toBeUndefined();
    expect(errors.phone).toBeUndefined();
    expect(errors.consent).toBeUndefined();
  });
});

describe("hasCatalogFormErrors", () => {
  it("é falso para o objeto vazio", () => {
    expect(hasCatalogFormErrors({})).toBe(false);
  });

  it("é falso quando as chaves existem mas estão apagadas (limpeza por campo)", () => {
    expect(hasCatalogFormErrors({ name: undefined, consent: undefined })).toBe(false);
  });

  it("é verdadeiro com qualquer erro presente", () => {
    expect(hasCatalogFormErrors({ consent: "consentRequired" })).toBe(true);
  });
});

describe("paridade com o schema do servidor", () => {
  it("o assunto do catálogo é aceito por contactSchema", () => {
    expect(CONTACT_SUBJECTS).toContain(CATALOG_SUBJECT);
  });

  it("um corpo aprovado no cliente também passa no servidor", () => {
    const parsed = contactSchema.safeParse({
      name: VALID.name,
      email: VALID.email,
      phone: VALID.phone,
      companyName: VALID.companyName,
      subject: CATALOG_SUBJECT,
      origin: CATALOG_FALLBACK_ORIGIN,
      locale: "pt",
      consent: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("o mínimo de nome do cliente casa com o do servidor (1 char reprova nos dois)", () => {
    expect(validateCatalogForm(values({ name: "A" }), true).name).toBe("nameTooShort");
    const parsed = contactSchema.safeParse({
      name: "A",
      email: VALID.email,
      phone: VALID.phone,
      subject: CATALOG_SUBJECT,
      locale: "pt",
      consent: true,
    });
    expect(parsed.success).toBe(false);
  });

  it("empresa omitida continua válida no servidor", () => {
    const parsed = contactSchema.safeParse({
      name: VALID.name,
      email: VALID.email,
      phone: VALID.phone,
      companyName: "",
      subject: CATALOG_SUBJECT,
      locale: "pt",
      consent: true,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("resolveCatalogOrigin", () => {
  it("preserva a origem que veio da URL (o CTA vale mais que a página)", () => {
    expect(resolveCatalogOrigin("home-hero")).toBe("home-hero");
    expect(resolveCatalogOrigin("rodape")).toBe("rodape");
  });

  it.each(LEAD_ORIGINS)("aceita a origem conhecida %s", (origin) => {
    expect(resolveCatalogOrigin(origin)).toBe(origin);
  });

  it("cai no fallback quando a URL não traz origem", () => {
    expect(resolveCatalogOrigin(undefined)).toBe(CATALOG_FALLBACK_ORIGIN);
    expect(resolveCatalogOrigin("")).toBe(CATALOG_FALLBACK_ORIGIN);
  });

  it("cai no fallback para valor forjado, em vez de gravar lixo", () => {
    expect(resolveCatalogOrigin("<script>")).toBe(CATALOG_FALLBACK_ORIGIN);
    expect(resolveCatalogOrigin("home-heroX")).toBe(CATALOG_FALLBACK_ORIGIN);
  });

  it("cai no fallback para tipos que não são string (array repetido na query)", () => {
    expect(resolveCatalogOrigin(["menu"])).toBe(CATALOG_FALLBACK_ORIGIN);
    expect(resolveCatalogOrigin(null)).toBe(CATALOG_FALLBACK_ORIGIN);
    expect(resolveCatalogOrigin(42)).toBe(CATALOG_FALLBACK_ORIGIN);
  });

  it("o fallback é uma origem conhecida (nunca gravaria valor fora da lista)", () => {
    expect(LEAD_ORIGINS).toContain(CATALOG_FALLBACK_ORIGIN);
  });
});

describe("catalogDownloadLink", () => {
  it("same-origin baixa o arquivo e mantém a pessoa no painel de sucesso", () => {
    expect(catalogDownloadLink("/downloads/catalogo-roco-2026.pdf")).toEqual({
      href: "/downloads/catalogo-roco-2026.pdf",
      download: CATALOG_PDF_FILENAME,
    });
  });

  it("cross-origin abre em aba nova (o navegador ignoraria o download)", () => {
    expect(catalogDownloadLink("https://pub-abc.r2.dev/catalogo.pdf")).toEqual({
      href: "https://pub-abc.r2.dev/catalogo.pdf",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("trata URL protocol-relative como externa", () => {
    expect(catalogDownloadLink("//cdn.exemplo.com/catalogo.pdf").target).toBe("_blank");
  });

  it("nunca marca download em destino externo", () => {
    expect(catalogDownloadLink("http://exemplo.com/x.pdf").download).toBeUndefined();
  });

  it("nunca abre aba nova para destino interno", () => {
    expect(catalogDownloadLink("/x.pdf").target).toBeUndefined();
  });

  it("fecha o acesso a window.opener no destino externo", () => {
    expect(catalogDownloadLink("https://exemplo.com/x.pdf").rel).toBe("noopener noreferrer");
  });

  it("devolve a href intocada quando não há URL (não inventa atributos)", () => {
    expect(catalogDownloadLink("")).toEqual({ href: "" });
  });
});

describe("espelho client↔servidor do e-mail", () => {
  // O regex aproximado que existia aqui aceitava endereços que o zod reprova;
  // o formulário deixava passar e o visitante recebia 400 traduzido como
  // "tente novamente em instantes". Estes casos travam o alinhamento.
  const REJECTED = [
    "joao@empresa.c",
    "user@exa_mple.com",
    "joao..silva@empresa.com",
    ".joao@empresa.com",
    "sem-arroba.com",
    "joao@",
  ];

  it.each(REJECTED)("reprova '%s' nos DOIS lados", (email) => {
    expect(validateCatalogForm({ ...VALID, email }, true).email).toBe("invalidEmail");
    expect(contactSchema.shape.email.safeParse(email).success).toBe(false);
  });

  const ACCEPTED = ["joao@empresa.com", "maria.silva@sub.exemplo.com.br", "a+tag@dominio.io"];

  it.each(ACCEPTED)("aceita '%s' nos DOIS lados", (email) => {
    expect(validateCatalogForm({ ...VALID, email }, true).email).toBeUndefined();
    expect(contactSchema.shape.email.safeParse(email).success).toBe(true);
  });
});

describe("catalogServerFieldErrors", () => {
  it("marca o campo culpado em vez de deixar tudo para o banner genérico", () => {
    expect(catalogServerFieldErrors(["email"])).toEqual({ email: "invalidEmail" });
  });

  it("traduz cada campo que este formulário renderiza", () => {
    expect(catalogServerFieldErrors(["name", "email", "phone", "companyName", "consent"])).toEqual({
      name: "invalid",
      email: "invalidEmail",
      phone: "invalidPhone",
      companyName: "invalid",
      consent: "consentRequired",
    });
  });

  it("ignora campo que este formulário nem renderiza (o caller cai no banner)", () => {
    expect(catalogServerFieldErrors(["cnpj", "message", "productSlug"])).toEqual({});
  });

  it("ignora entradas que não são string", () => {
    expect(catalogServerFieldErrors([1, null, { email: 1 }, ["email"]])).toEqual({});
  });

  it("devolve vazio quando o corpo do 400 não trouxe 'fields'", () => {
    expect(catalogServerFieldErrors(undefined)).toEqual({});
    expect(catalogServerFieldErrors(null)).toEqual({});
    expect(catalogServerFieldErrors("email")).toEqual({});
    expect(catalogServerFieldErrors({ 0: "email" })).toEqual({});
  });

  it("o resultado alimenta hasCatalogFormErrors (é o que decide o banner)", () => {
    expect(hasCatalogFormErrors(catalogServerFieldErrors(["email"]))).toBe(true);
    expect(hasCatalogFormErrors(catalogServerFieldErrors(["cnpj"]))).toBe(false);
  });

  it("nunca lança, mesmo com array gigante ou valores estranhos", () => {
    expect(() => catalogServerFieldErrors(new Array(1000).fill("email"))).not.toThrow();
    expect(() => catalogServerFieldErrors([Symbol("x")])).not.toThrow();
  });
});
