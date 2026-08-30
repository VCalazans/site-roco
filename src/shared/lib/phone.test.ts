import { describe, it, expect } from "vitest";
import { formatPhoneBR, formatPhoneDisplayBR } from "./phone";

/**
 * `formatPhoneBR` já é coberto em `src/modules/portal/lib/phone.test.ts` (a
 * fonte é esta, o portal re-exporta). Aqui cobrimos só `formatPhoneDisplayBR`,
 * que nasceu para o rodapé: o `contact.phone` de `site_settings` é gravado no
 * formato do link do WhatsApp (com DDI) e saía cru na página.
 */
describe("formatPhoneDisplayBR", () => {
  it("formata o valor REAL do banco (12 dígitos, com DDI 55)", () => {
    expect(formatPhoneDisplayBR("554733352012")).toBe("(47) 3335-2012");
  });

  it("formata celular com DDI (13 dígitos)", () => {
    expect(formatPhoneDisplayBR("5547999998888")).toBe("(47) 99999-8888");
  });

  it("formata número nacional sem DDI (10 dígitos)", () => {
    expect(formatPhoneDisplayBR("4733352012")).toBe("(47) 3335-2012");
  });

  it("formata número nacional sem DDI (11 dígitos)", () => {
    expect(formatPhoneDisplayBR("47999998888")).toBe("(47) 99999-8888");
  });

  it("aceita entrada já mascarada e devolve a mesma máscara", () => {
    expect(formatPhoneDisplayBR("(47) 3335-2012")).toBe("(47) 3335-2012");
  });

  it("aceita DDI escrito com símbolos", () => {
    expect(formatPhoneDisplayBR("+55 (47) 3335-2012")).toBe("(47) 3335-2012");
  });

  it("NÃO corta em 11 dígitos como `formatPhoneBR` faria", () => {
    // A armadilha que motivou a função: o helper de formulário trunca e
    // produz um número que não existe.
    expect(formatPhoneBR("554733352012")).toBe("(55) 47333-5201");
    expect(formatPhoneDisplayBR("554733352012")).not.toBe(
      formatPhoneBR("554733352012")
    );
  });

  it("devolve como veio quando não reconhece o formato", () => {
    // Campo editado à mão pelo admin: melhor mostrar o que ele escreveu do
    // que inventar máscara sobre entrada desconhecida.
    expect(formatPhoneDisplayBR("0800 123 4567")).toBe("0800 123 4567");
    expect(formatPhoneDisplayBR("123")).toBe("123");
    expect(formatPhoneDisplayBR("  ramal 42  ")).toBe("ramal 42");
  });

  it("devolve string vazia para entrada vazia ou só espaços", () => {
    expect(formatPhoneDisplayBR("")).toBe("");
    expect(formatPhoneDisplayBR("   ")).toBe("");
  });

  it("não trata como DDI um número longo que não começa com 55", () => {
    expect(formatPhoneDisplayBR("14733352012")).toBe("(14) 73335-2012");
  });
});
