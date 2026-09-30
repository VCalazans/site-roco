import { describe, expect, it } from "vitest";
import { buildContentDisposition } from "./content-disposition";

describe("buildContentDisposition", () => {
  it("modo + nome ASCII + nome real em UTF-8", () => {
    expect(buildContentDisposition("attachment", "Política comercial.pdf")).toBe(
      "attachment; filename=\"Politica comercial.pdf\"; filename*=UTF-8''Pol%C3%ADtica%20comercial.pdf"
    );
    expect(buildContentDisposition("inline", "catalogo.pdf")).toBe(
      "inline; filename=\"catalogo.pdf\"; filename*=UTF-8''catalogo.pdf"
    );
  });

  it("aspas, barras e ponto-e-vírgula não quebram nem injetam parâmetros", () => {
    const header = buildContentDisposition("attachment", 'a"; filename="evil.exe;\\b/c.pdf');
    expect(header.startsWith('attachment; filename="a__ filename=_evil.exe__b_c.pdf"; filename*=')).toBe(true);
    // na forma RFC 5987 tudo que não é attr-char vira %XX
    expect(header.split("filename*=")[1]).not.toMatch(/["; \\]/);
  });

  it("caracteres de controle e não-ASCII viram _ no fallback; `'()*` são codificados", () => {
    const header = buildContentDisposition("attachment", "tabela\n(v2)*'.xlsx");
    expect(header).toContain('filename="tabela_(v2)*\'.xlsx"');
    expect(header).toContain("filename*=UTF-8''tabela%0A%28v2%29%2A%27.xlsx");
  });

  it("nome vazio ou só com símbolos vira 'material'", () => {
    expect(buildContentDisposition("inline", "")).toContain('filename="material"');
  });
});
