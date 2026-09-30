import { describe, expect, it } from "vitest";
import { readSmtpConfig } from "./smtp-config";

describe("readSmtpConfig", () => {
  it("sem SMTP_HOST: não configurado", () => {
    expect(readSmtpConfig({})).toEqual({ status: "not_configured" });
    expect(readSmtpConfig({ SMTP_HOST: "  ", MAIL_FROM: "a@b.com" })).toEqual({ status: "not_configured" });
  });

  it("com host, exige remetente e porta válida", () => {
    expect(readSmtpConfig({ SMTP_HOST: "smtp.roco.com.br" })).toEqual({ status: "invalid", reason: "MAIL_FROM vazio" });
    expect(readSmtpConfig({ SMTP_HOST: "smtp.roco.com.br", MAIL_FROM: "a@b.com", SMTP_PORT: "abc" }).status).toBe(
      "invalid"
    );
  });

  it("padrão seguro: porta 587 com STARTTLS obrigatório", () => {
    const result = readSmtpConfig({
      SMTP_HOST: "smtp.roco.com.br",
      SMTP_USER: "portal@roco.com.br",
      SMTP_PASSWORD: "segredo",
      MAIL_FROM: "ROCO <nao-responda@roco.com.br>",
    });
    expect(result).toEqual({
      status: "ok",
      config: {
        host: "smtp.roco.com.br",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user: "portal@roco.com.br", pass: "segredo" },
        from: "ROCO <nao-responda@roco.com.br>",
      },
    });
  });

  it("SMTP_SECURE=true usa a 465 com TLS direto; SMTP_REQUIRE_TLS=false só para capturador local", () => {
    const secure = readSmtpConfig({ SMTP_HOST: "smtp.x", MAIL_FROM: "a@b.com", SMTP_SECURE: "true" });
    expect(secure.status === "ok" && [secure.config.port, secure.config.secure, secure.config.requireTLS]).toEqual([
      465,
      true,
      false,
    ]);
    const local = readSmtpConfig({ SMTP_HOST: "localhost", SMTP_PORT: "1025", MAIL_FROM: "a@b.com", SMTP_REQUIRE_TLS: "false" });
    expect(local.status === "ok" && [local.config.port, local.config.requireTLS, local.config.auth]).toEqual([
      1025,
      false,
      undefined,
    ]);
  });

  it("MAIL_REPLY_TO opcional", () => {
    const result = readSmtpConfig({ SMTP_HOST: "smtp.x", MAIL_FROM: "a@b.com", MAIL_REPLY_TO: "comercial@roco.com.br" });
    expect(result.status === "ok" && result.config.replyTo).toBe("comercial@roco.com.br");
  });
});
