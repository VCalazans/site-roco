import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCatalogFile, getPresignedDownloadUrl } = vi.hoisted(() => ({
  getCatalogFile: vi.fn(),
  getPresignedDownloadUrl: vi.fn(),
}));

vi.mock("@/server/lib/site-settings", () => ({ getCatalogFile }));
vi.mock("@/core/storage/r2", () => ({ getPresignedDownloadUrl }));

import { GET } from "./route";

const BUNDLED_PDF = "/downloads/catalogo-roco-2026.pdf";

describe("GET /api/catalog/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("entrega o arquivo enviado pelo portal como anexo, com o nome original", async () => {
    getCatalogFile.mockResolvedValue({ key: "site/catalogo/a.pdf", filename: "Catálogo.pdf" });
    getPresignedDownloadUrl.mockResolvedValue("https://s3.test/a.pdf?sig=1");

    const response = await GET();

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://s3.test/a.pdf?sig=1");
    const [key, ttl, options] = getPresignedDownloadUrl.mock.calls[0];
    expect(key).toBe("site/catalogo/a.pdf");
    expect(ttl).toBe(60);
    expect(options.contentDisposition).toMatch(/^attachment/);
  });

  it("sem arquivo enviado, entrega o PDF da imagem, nunca um endereço externo", async () => {
    getCatalogFile.mockResolvedValue(null);

    const response = await GET();

    expect(response.headers.get("location")).toBe(BUNDLED_PDF);
  });

  it("com o banco fora do ar, entrega o PDF da imagem", async () => {
    getCatalogFile.mockRejectedValue(new Error("db down"));

    const response = await GET();

    expect(response.headers.get("location")).toBe(BUNDLED_PDF);
  });
});
