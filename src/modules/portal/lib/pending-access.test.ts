import { describe, expect, it } from "vitest";
import { formatSubmittedDate } from "./pending-access";

describe("formatSubmittedDate", () => {
  it("escreve a data por extenso no idioma da página", () => {
    const date = new Date("2026-09-30T15:00:00Z");
    expect(formatSubmittedDate(date, "pt")).toBe("30 de setembro de 2026");
    expect(formatSubmittedDate(date, "en")).toBe("September 30, 2026");
  });

  it("usa o fuso de Brasília: 01:30 UTC ainda é o dia anterior", () => {
    expect(formatSubmittedDate(new Date("2026-10-01T01:30:00Z"), "pt")).toBe("30 de setembro de 2026");
  });
});
