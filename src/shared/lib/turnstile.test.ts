import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTACT_SUBJECTS } from "@/server/lib/contact-submit";
import { contactTurnstileAction, getTurnstileSiteKey, TURNSTILE_ACTIONS } from "./turnstile";

describe("TURNSTILE_ACTIONS", () => {
  it("cabem no limite da Cloudflare: até 32 caracteres, só letras, dígitos, `_` e `-`", () => {
    for (const action of Object.values(TURNSTILE_ACTIONS)) {
      expect(action).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
    }
  });

  it("cada formulário tem a sua ação (um token não serve em outro formulário)", () => {
    const actions = Object.values(TURNSTILE_ACTIONS);
    expect(new Set(actions).size).toBe(actions.length);
  });
});

describe("contactTurnstileAction", () => {
  it("separa os três formulários que dividem `POST /api/contact`", () => {
    expect(contactTurnstileAction("catalog")).toBe("catalogo");
    expect(contactTurnstileAction("cart")).toBe("orcamento");
    for (const subject of ["call_back", "quote", "general"]) {
      expect(contactTurnstileAction(subject)).toBe("contato");
    }
  });

  it("cobre todos os assuntos aceitos pela rota", () => {
    for (const subject of CONTACT_SUBJECTS) {
      expect(Object.values(TURNSTILE_ACTIONS)).toContain(contactTurnstileAction(subject));
    }
  });

  it("assunto desconhecido ou ausente (corpo cru, antes do schema) cai em `contato`", () => {
    for (const subject of [undefined, null, "", "CATALOG", 42, { subject: "cart" }]) {
      expect(contactTurnstileAction(subject)).toBe("contato");
    }
  });
});

describe("getTurnstileSiteKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("vazia quando a variável não existe ou só tem espaços", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    expect(getTurnstileSiteKey()).toBe("");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "   ");
    expect(getTurnstileSiteKey()).toBe("");
  });

  it("tira espaços em volta (valor colado de painel de deploy)", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", " 1x00000000000000000000AA\n");
    expect(getTurnstileSiteKey()).toBe("1x00000000000000000000AA");
  });
});
