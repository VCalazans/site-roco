import { describe, expect, it } from "vitest";
import { describeMailError } from "./mailer";

describe("describeMailError", () => {
  it("mantém código e código SMTP, e troca os endereços de e-mail por <e-mail>", () => {
    const error = Object.assign(
      new Error("Can't send mail - all recipients were rejected: 550 5.1.1 <maria.souza+teste@empresa.com.br>: Recipient address rejected"),
      { code: "EENVELOPE", responseCode: 550 }
    );
    const description = describeMailError(error);
    expect(description).toContain("EENVELOPE · 550");
    expect(description).toContain("<<e-mail>>: Recipient address rejected");
    expect(description).not.toContain("maria.souza");
    expect(description).not.toContain("empresa.com.br");
  });

  it("o que não é Error vira um texto fixo", () => {
    expect(describeMailError("falhou")).toBe("erro desconhecido");
  });
});
