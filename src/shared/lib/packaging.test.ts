import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import pt from "@/i18n/dictionaries/pt.json";
import { PACKAGING_TYPE_ORDER, describePackaging, sortPackagings } from "./packaging";

const item = (packagingType: string, unitsPerPack: number) => ({ packagingType, unitsPerPack });

describe("sortPackagings", () => {
  it("ordena por tipo e depois pela quantidade, sem mutar a entrada", () => {
    const input = [item("caixa", 12), item("blister", 12), item("peca", 6), item("blister", 1), item("peca", 1)];
    const snapshot = JSON.stringify(input);
    expect(sortPackagings(input)).toEqual([
      item("peca", 1),
      item("peca", 6),
      item("blister", 1),
      item("blister", 12),
      item("caixa", 12),
    ]);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("tipo desconhecido vai para o fim, sem sumir", () => {
    const sorted = sortPackagings([item("pallet", 100), item("peca", 1)]);
    expect(sorted.map((p) => p.packagingType)).toEqual(["peca", "pallet"]);
  });

  it("mantém TODAS as embalagens (nenhuma é descartada por ser 'não padrão')", () => {
    const all = PACKAGING_TYPE_ORDER.flatMap((type) => [item(type, 1), item(type, 12), item(type, 36)]);
    expect(sortPackagings(all)).toHaveLength(all.length);
  });
});

describe("describePackaging", () => {
  const ptCopy = pt.products.packagingInfo;
  const enCopy = en.products.packagingInfo;

  it("peça × 1 vira 'peça avulsa'", () => {
    expect(describePackaging(item("peca", 1), ptCopy)).toEqual({
      title: ptCopy.singlePieceTitle,
      detail: ptCopy.singlePiece,
    });
  });

  it("singular e plural com a quantidade interpolada", () => {
    expect(describePackaging(item("blister", 1), ptCopy)).toEqual({ title: "Blister", detail: "1 unidade por embalagem" });
    expect(describePackaging(item("blister", 12), ptCopy)).toEqual({ title: "Blister", detail: "12 unidades por embalagem" });
    expect(describePackaging(item("saco_plastico", 36), enCopy)).toEqual({ title: "Plastic bag", detail: "36 units per pack" });
  });

  it("todo tipo do enum tem título nos dois idiomas", () => {
    for (const type of PACKAGING_TYPE_ORDER) {
      expect(ptCopy.types[type]).toBeTruthy();
      expect(enCopy.types[type]).toBeTruthy();
    }
  });

  it("tipo desconhecido não quebra", () => {
    expect(describePackaging(item("caixa_master", 2), ptCopy).title).toBe("caixa master");
  });
});
