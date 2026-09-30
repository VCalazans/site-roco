import { describe, expect, it } from "vitest";
import { formatFileSize } from "./file-size";

describe("formatFileSize", () => {
  it("KB e MB com o separador do idioma", () => {
    expect(formatFileSize(500, "pt-BR")).toBe("1 KB");
    expect(formatFileSize(300 * 1024, "pt-BR")).toBe("300 KB");
    expect(formatFileSize(2.5 * 1024 * 1024, "pt-BR")).toBe("2,5 MB");
    expect(formatFileSize(2.5 * 1024 * 1024, "en")).toBe("2.5 MB");
    expect(formatFileSize(25 * 1024 * 1024, "pt-BR")).toBe("25 MB");
  });

  it("GB para downloads grandes", () => {
    expect(formatFileSize(1.5 * 1024 * 1024 * 1024, "pt-BR")).toBe("1,5 GB");
    expect(formatFileSize(2 * 1024 * 1024 * 1024, "en")).toBe("2 GB");
  });

  it("valor inválido vira travessão", () => {
    expect(formatFileSize(0, "pt-BR")).toBe("—");
    expect(formatFileSize(Number.NaN, "pt-BR")).toBe("—");
  });
});
