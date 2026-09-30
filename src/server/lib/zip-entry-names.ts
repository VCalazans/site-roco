/**
 * Nomes de pastas e arquivos dentro do ZIP de imagens de produto — puros e
 * testáveis. Tudo vem do banco (nome original do upload, SKU, nome do
 * produto — este último também do ERP), então nada passa cru: sem barra (não
 * cria pasta nem permite "../" do lado de quem extrai), sem caractere
 * proibido no Windows, sem controle nem caractere invisível de direção de
 * texto, sem ponto/espaço nas pontas e sem nome reservado do Windows.
 */

const FORBIDDEN_CHARS = new Set(["<", ">", ":", '"', "/", "\\", "|", "?", "*"]);
const MAX_SEGMENT_LENGTH = 100;
/**
 * Quanto da entrada é lido: o resto é descartado ANTES de qualquer outro
 * processamento. O custo fica constante mesmo com um nome de produto enorme
 * (a coluna é `text`, sem limite) — sem isso, uma regex de fim de texto sobre
 * milhares de pontos custava tempo quadrático e travava o processo.
 */
const MAX_INPUT_CODE_POINTS = MAX_SEGMENT_LENGTH * 4;
/** Controles de direção do texto (bidi) e marcas invisíveis: somem do nome. */
const INVISIBLE_CHARS = /[؜​-‏‪-‮⁦-⁩﻿]/;
/** Nomes que o Windows reserva para dispositivos (com ou sem extensão). */
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const KNOWN_EXTENSION = /\.(jpe?g|png|webp)$/i;

function isControl(code: number): boolean {
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
}

/** Tira ponto e espaço do fim — laço, e não regex, para ser linear. */
function trimTrailingDotsAndSpaces(value: string): string {
  let end = value.length;
  while (end > 0 && (value[end - 1] === "." || value[end - 1] === " ")) end -= 1;
  return value.slice(0, end);
}

/**
 * Um segmento de caminho seguro, ou `""` quando não sobra nada aproveitável
 * (quem chama escolhe a alternativa). Corta por caractere (não por unidade
 * UTF-16), sem partir acento nem emoji.
 */
function safeSegment(value: string): string {
  const chars: string[] = [];
  for (const char of value.normalize("NFC")) {
    if (chars.length === MAX_INPUT_CODE_POINTS) break;
    if (INVISIBLE_CHARS.test(char)) continue;
    const code = char.codePointAt(0) ?? 0;
    chars.push(isControl(code) || FORBIDDEN_CHARS.has(char) ? "-" : char);
  }
  const collapsed = chars.join("").replace(/\s+/g, " ").trim().replace(/^[.\s-]+/, "");
  const limited = trimTrailingDotsAndSpaces(Array.from(collapsed).slice(0, MAX_SEGMENT_LENGTH).join("").trim());
  return WINDOWS_RESERVED_NAME.test(limited) ? `${limited}-` : limited;
}

/** Um segmento de caminho seguro; `fallback` (constante) quando não sobra nada aproveitável. */
export function sanitizePathSegment(value: string, fallback: string): string {
  return safeSegment(value) || fallback;
}

/**
 * Pasta de um produto no ZIP de vários produtos: "1122 - Válvula de Descarga".
 * Se o nome não render nada, tenta o SKU — também saneado: um SKU como
 * "../.." não pode virar caminho — e, por fim, "produto".
 */
export function productFolderName(product: { sku: string; namePt: string }): string {
  return safeSegment(`${product.sku} - ${product.namePt}`) || safeSegment(product.sku) || "produto";
}

/**
 * Caminho que qualquer extrator grava DENTRO da pasta de destino: relativo,
 * sem segmento vazio, "." ou "..", sem barra invertida nem controle.
 */
export function isSafeZipPath(path: string): boolean {
  if (path.length === 0 || path.startsWith("/") || path.includes("\\")) return false;
  for (const char of path) {
    if (isControl(char.codePointAt(0) ?? 0)) return false;
  }
  return path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/**
 * Arquivo de uma imagem: posição de exibição + nome original
 * ("01-1122.png"). A posição mantém a ordem do site e evita colisão entre
 * duas fotos enviadas com o mesmo nome; a extensão é garantida pelo tipo.
 */
export function imageEntryName(position: number, image: { filename: string; contentType: string }): string {
  const prefix = String(position).padStart(2, "0");
  const base = sanitizePathSegment(image.filename, "imagem");
  const extension = IMAGE_EXTENSIONS[image.contentType];
  const named = KNOWN_EXTENSION.test(base) || !extension ? base : `${base}.${extension}`;
  return `${prefix}-${named}`;
}

export type ZipImageRow = {
  productId: string;
  sku: string;
  namePt: string;
  r2Key: string;
  filename: string;
  contentType: string;
  createdAt: Date;
};

/**
 * Entradas do ZIP a partir das linhas JÁ ordenadas (produto, depois ordem de
 * exibição). Um produto só: arquivos na raiz. Vários: uma pasta por produto
 * (calculada uma vez por produto). A numeração recomeça em cada produto e
 * segue a ordem do site (a capa é a 01).
 *
 * Última barreira: caminho inseguro é erro de programação — lança em vez de
 * entregar ao representante um ZIP que escreve fora da pasta de extração.
 */
export function buildImageZipEntries(
  rows: readonly ZipImageRow[],
  options: { groupByProduct: boolean }
): { path: string; r2Key: string; lastModified: Date }[] {
  const positions = new Map<string, number>();
  const folders = new Map<string, string>();
  const entries = rows.map((row) => {
    const position = (positions.get(row.productId) ?? 0) + 1;
    positions.set(row.productId, position);
    const file = imageEntryName(position, row);
    let folder = folders.get(row.productId);
    if (options.groupByProduct && folder === undefined) {
      folder = productFolderName(row);
      folders.set(row.productId, folder);
    }
    return {
      path: options.groupByProduct ? `${folder}/${file}` : file,
      r2Key: row.r2Key,
      lastModified: row.createdAt,
    };
  });
  const paths = dedupePaths(entries.map((entry) => entry.path));
  const unsafe = paths.find((path) => !isSafeZipPath(path));
  if (unsafe !== undefined) {
    throw new Error(`Caminho inseguro no ZIP de imagens: ${JSON.stringify(unsafe)}`);
  }
  return entries.map((entry, index) => ({ ...entry, path: paths[index] }));
}

/** Garante caminhos únicos: repetidos ganham " (2)", " (3)"… antes da extensão. */
export function dedupePaths(paths: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return paths.map((path) => {
    const key = path.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 1) return path;
    const dot = path.lastIndexOf(".");
    const slash = path.lastIndexOf("/");
    return dot > slash + 1
      ? `${path.slice(0, dot)} (${count})${path.slice(dot)}`
      : `${path} (${count})`;
  });
}
