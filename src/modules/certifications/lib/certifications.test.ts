import { describe, expect, it } from "vitest";
import {
  certificationInputSchema,
  certificationStatus,
  isCertificationImageKey,
  isCertificationImagePath,
  isCertificationVisible,
  todayInBrazil,
  toPublicCertification,
} from "@/modules/certifications/lib/certifications";

const KEY = "site/certificacoes/123e4567-e89b-12d3-a456-426614174000.png";

describe("todayInBrazil", () => {
  it("usa o fuso de Brasília (23h de 31/12 em SP ainda é 31/12)", () => {
    expect(todayInBrazil(new Date("2027-01-01T02:30:00Z"))).toBe("2026-12-31");
    expect(todayInBrazil(new Date("2027-01-01T03:30:00Z"))).toBe("2027-01-01");
  });
});

describe("certificationStatus", () => {
  it("sem data = sem vencimento", () => {
    expect(certificationStatus(null, "2026-10-13")).toBe("noExpiry");
  });

  it("o último dia ainda vale; o dia seguinte está vencido", () => {
    expect(certificationStatus("2027-02-28", "2027-02-28")).toBe("expiringSoon");
    expect(certificationStatus("2027-02-28", "2027-03-01")).toBe("expired");
  });

  it("avisa a partir de 60 dias antes", () => {
    expect(certificationStatus("2027-02-28", "2026-12-30")).toBe("expiringSoon");
    expect(certificationStatus("2027-02-28", "2026-12-29")).toBe("valid");
  });
});

describe("isCertificationVisible", () => {
  const base = { active: true, validUntil: "2027-02-28", imageKey: KEY, imagePath: null };

  it("ativo, com imagem e vigente aparece", () => {
    expect(isCertificationVisible(base, "2026-10-13")).toBe(true);
  });

  it("desativado, vencido ou sem imagem não aparece", () => {
    expect(isCertificationVisible({ ...base, active: false }, "2026-10-13")).toBe(false);
    expect(isCertificationVisible(base, "2027-03-01")).toBe(false);
    expect(isCertificationVisible({ ...base, imageKey: null }, "2026-10-13")).toBe(false);
  });

  it("aceita a imagem de public/ do selo que já existia", () => {
    expect(
      isCertificationVisible(
        { ...base, imageKey: null, imagePath: "/images/certifications/gptw-certificada-2026-2027.png" },
        "2026-10-13"
      )
    ).toBe(true);
  });
});

describe("chaves e caminhos de imagem", () => {
  it("só aceita a chave gerada pelo presign", () => {
    expect(isCertificationImageKey(KEY)).toBe(true);
    expect(isCertificationImageKey("site/home/123e4567-e89b-12d3-a456-426614174000.png")).toBe(false);
    expect(isCertificationImageKey("site/certificacoes/../products/x.png")).toBe(false);
  });

  it("só aceita arquivo de /images/certifications/", () => {
    expect(isCertificationImagePath("/images/certifications/gptw-certificada-2026-2027.png")).toBe(true);
    expect(isCertificationImagePath("https://evil.example/x.png")).toBe(false);
  });
});

describe("certificationInputSchema", () => {
  it("normaliza campos vazios para null", () => {
    const parsed = certificationInputSchema.parse({ namePt: "ISO 9001", nameEn: "", linkUrl: "", validUntil: null });
    expect(parsed).toMatchObject({ namePt: "ISO 9001", nameEn: null, linkUrl: null, validUntil: null, active: true });
  });

  it("recusa link sem https, data malformada e chave de imagem estranha", () => {
    expect(certificationInputSchema.safeParse({ namePt: "ISO", linkUrl: "http://x.com" }).success).toBe(false);
    expect(certificationInputSchema.safeParse({ namePt: "ISO", linkUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(certificationInputSchema.safeParse({ namePt: "ISO", validUntil: "28/02/2027" }).success).toBe(false);
    expect(certificationInputSchema.safeParse({ namePt: "ISO", imageKey: "products/x.png" }).success).toBe(false);
    expect(certificationInputSchema.safeParse({ namePt: "I" }).success).toBe(false);
  });
});

describe("toPublicCertification", () => {
  const row = {
    id: "1",
    namePt: "Great Place To Work®",
    nameEn: null,
    notePt: "Certificada · fev 2026 – fev 2027",
    noteEn: "Certified · Feb 2026 – Feb 2027",
    altPt: null,
    altEn: null,
    linkUrl: null,
  };

  it("usa o idioma da página e cai no português quando falta o inglês", () => {
    const en = toPublicCertification(row, "/x.png", "en");
    expect(en.label).toBe("Great Place To Work®");
    expect(en.note).toBe("Certified · Feb 2026 – Feb 2027");
    expect(en.alt).toBe("Great Place To Work®");
    expect(toPublicCertification(row, "/x.png", "pt").note).toBe("Certificada · fev 2026 – fev 2027");
  });
});
