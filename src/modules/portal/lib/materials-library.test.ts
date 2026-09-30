import { describe, expect, it } from "vitest";
import {
  MATERIAL_CATEGORY_ORDER,
  MATERIAL_NEW_DAYS,
  formatFileSize,
  groupMaterialsByCategory,
  isRecentMaterial,
  matchesMaterialSearch,
  materialDownloadHref,
  materialKind,
  normalizeMaterialCategory,
  opensInBrowser,
} from "./materials-library";

const material = (id: string, category: string | null) => ({ id, category });

describe("normalizeMaterialCategory", () => {
  it("mantém as categorias conhecidas", () => {
    for (const category of MATERIAL_CATEGORY_ORDER) expect(normalizeMaterialCategory(category)).toBe(category);
  });

  it("vazio, nulo ou desconhecido vira 'other' (nada some)", () => {
    expect(normalizeMaterialCategory(null)).toBe("other");
    expect(normalizeMaterialCategory("")).toBe("other");
    expect(normalizeMaterialCategory("  ")).toBe("other");
    expect(normalizeMaterialCategory("campanhas")).toBe("other");
    expect(normalizeMaterialCategory(" logistics ")).toBe("logistics");
  });
});

describe("groupMaterialsByCategory", () => {
  it("agrupa na ordem dos setores, preservando a ordem dentro do setor e omitindo setores vazios", () => {
    const groups = groupMaterialsByCategory([
      material("a", "training"),
      material("b", "commercial_policy"),
      material("c", "training"),
      material("d", null),
      material("e", "xyz"),
    ]);
    expect(groups.map((group) => group.category)).toEqual(["commercial_policy", "training", "other"]);
    expect(groups[1].items.map((item) => item.id)).toEqual(["a", "c"]);
    expect(groups[2].items.map((item) => item.id)).toEqual(["d", "e"]);
    expect(groups.flatMap((group) => group.items)).toHaveLength(5);
  });

  it("lista vazia → nenhum grupo", () => {
    expect(groupMaterialsByCategory([])).toEqual([]);
  });
});

describe("materialKind / opensInBrowser", () => {
  it("classifica os tipos aceitos no upload", () => {
    expect(materialKind("application/pdf")).toBe("pdf");
    expect(materialKind("video/mp4")).toBe("video");
    expect(materialKind("image/webp")).toBe("image");
    expect(materialKind("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("spreadsheet");
    expect(materialKind("application/vnd.ms-excel")).toBe("spreadsheet");
    expect(materialKind("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe("presentation");
    expect(materialKind("application/msword")).toBe("document");
    expect(materialKind("application/x-zip-compressed")).toBe("archive");
    expect(materialKind("application/octet-stream")).toBe("file");
  });

  it("só PDF, vídeo e imagem abrem no navegador", () => {
    expect(opensInBrowser("pdf")).toBe(true);
    expect(opensInBrowser("video")).toBe(true);
    expect(opensInBrowser("image")).toBe(true);
    expect(opensInBrowser("spreadsheet")).toBe(false);
    expect(opensInBrowser("archive")).toBe(false);
  });
});

describe("matchesMaterialSearch", () => {
  const item = {
    titlePt: "Política comercial 2026",
    titleEn: "Commercial policy 2026",
    descriptionPt: "Prazos e condições de pagamento",
    descriptionEn: null,
  };

  it("ignora acento e caixa, e exige todas as palavras", () => {
    expect(matchesMaterialSearch(item, "politica")).toBe(true);
    expect(matchesMaterialSearch(item, "CONDICOES pagamento")).toBe(true);
    expect(matchesMaterialSearch(item, "commercial")).toBe(true);
    expect(matchesMaterialSearch(item, "politica frete")).toBe(false);
  });

  it("busca vazia casa tudo", () => {
    expect(matchesMaterialSearch(item, "   ")).toBe(true);
  });
});

describe("isRecentMaterial", () => {
  const now = new Date("2026-09-30T12:00:00Z");

  it(`é recente até ${MATERIAL_NEW_DAYS} dias`, () => {
    expect(isRecentMaterial("2026-09-29T12:00:00Z", now)).toBe(true);
    expect(isRecentMaterial("2026-09-16T12:00:00Z", now)).toBe(true);
    expect(isRecentMaterial("2026-09-15T11:00:00Z", now)).toBe(false);
  });

  it("sem data, data inválida ou no futuro não é 'novo'", () => {
    expect(isRecentMaterial(null, now)).toBe(false);
    expect(isRecentMaterial("não é data", now)).toBe(false);
    expect(isRecentMaterial("2026-10-05T00:00:00Z", now)).toBe(false);
  });
});

describe("formatFileSize", () => {
  it("KB e MB com o separador do idioma", () => {
    expect(formatFileSize(500, "pt-BR")).toBe("1 KB");
    expect(formatFileSize(300 * 1024, "pt-BR")).toBe("300 KB");
    expect(formatFileSize(2.5 * 1024 * 1024, "pt-BR")).toBe("2,5 MB");
    expect(formatFileSize(2.5 * 1024 * 1024, "en")).toBe("2.5 MB");
    expect(formatFileSize(25 * 1024 * 1024, "pt-BR")).toBe("25 MB");
  });

  it("valor inválido vira travessão", () => {
    expect(formatFileSize(0, "pt-BR")).toBe("—");
    expect(formatFileSize(Number.NaN, "pt-BR")).toBe("—");
  });
});

describe("materialDownloadHref", () => {
  it("aponta para a rota autenticada, com o modo em português", () => {
    expect(materialDownloadHref("123e4567-e89b-42d3-a456-426614174000", "inline")).toBe(
      "/api/portal/materials/123e4567-e89b-42d3-a456-426614174000/download?modo=abrir"
    );
    expect(materialDownloadHref("x/../y", "attachment")).toBe("/api/portal/materials/x%2F..%2Fy/download?modo=baixar");
  });
});
