/**
 * Validação de links EDITÁVEIS no painel (CTAs da home e dos slides do hero).
 *
 * Por que existe: o operador digita o destino do botão em campo livre e o
 * valor vai direto para o `href` de um `<Link>`/`<a>` no site público. Sem
 * validação, `javascript:alert(document.cookie)` salvo por engano (ou por uma
 * conta comprometida) viraria XSS armazenado na página mais visitada do site
 * (spec 001, RF21 / modelo de ameaças).
 *
 * Aceita SOMENTE:
 *  - caminho interno absoluto (`/produtos`, `/pt/contato?assunto=quote`) —
 *    mas NUNCA protocol-relative (`//evil.com`), que o navegador resolve como
 *    outro domínio;
 *  - âncora/placeholder (`#produtos`, `#catalogo`, `#sobre`) — os
 *    placeholders são trocados pela rota real em `resolveDestination`;
 *  - URL absoluta `http:`/`https:`;
 *  - `mailto:` e `tel:` (contato direto).
 *
 * Qualquer outro esquema (`javascript:`, `data:`, `vbscript:`, `file:`…) é
 * rejeitado, inclusive com truques de ofuscação (espaços/controles no meio do
 * esquema, maiúsculas) — a checagem é por allowlist sobre o valor normalizado.
 *
 * Módulo PURO (sem `server-only`): usado pelos schemas zod do servidor e pelo
 * editor do portal para dar feedback antes do envio.
 */

/** Teto de tamanho de um href editável. */
export const MAX_HREF_LENGTH = 500;

const CONTROL_OR_SPACE = /[\u0000-\u001F\u007F\s]/;

export function isSafeHref(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const href = value.trim();
  if (href === "" || href.length > MAX_HREF_LENGTH) return false;
  // Caractere de controle/espaço em qualquer ponto: navegadores descartam
  // alguns deles ao interpretar o esquema (`java\tscript:`), então nenhum é
  // aceito — um link legítimo nunca precisa deles (espaço vira `%20`).
  if (CONTROL_OR_SPACE.test(href)) return false;

  if (href.startsWith("#")) return href.length > 1;
  if (href.startsWith("/")) return !href.startsWith("//") && !href.startsWith("/\\");

  const lower = href.toLowerCase();
  if (lower.startsWith("mailto:") || lower.startsWith("tel:")) return href.length > lower.indexOf(":") + 1;

  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    try {
      const url = new URL(href);
      return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.length > 0;
    } catch {
      return false;
    }
  }

  return false;
}
