/**
 * `Content-Disposition` seguro para um nome de arquivo vindo do banco (o nome
 * original do upload). Duas formas, como pede a RFC 6266:
 * - `filename="…"` em ASCII puro, sem aspas/barras/`;`/controle — o que os
 *   navegadores antigos entendem e que não permite injetar parâmetros;
 * - `filename*=UTF-8''…` com o nome real percent-encoded (RFC 5987), que os
 *   navegadores atuais preferem ("Política comercial.pdf" chega com acento).
 */

/** RFC 5987: além do que `encodeURIComponent` já codifica, `'()*` também precisam virar %XX. */
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function buildContentDisposition(mode: "inline" | "attachment", filename: string): string {
  const ascii =
    filename
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\/;]/g, "_")
      .trim() || "material";
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(filename)}`;
}
