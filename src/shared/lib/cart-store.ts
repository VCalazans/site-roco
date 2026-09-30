"use client";

/**
 * Carrinho de cotação — estado CLIENT-ONLY (`localStorage`), consumido por
 * mais de um assinante ao mesmo tempo (badge do header, página do carrinho,
 * botões "adicionar" nos cards) — por isso um store singleton com
 * `useSyncExternalStore` de verdade (subscribe que NOTIFICA, ao contrário do
 * `subscribe` no-op de `@/shared/components/consent/consent-banner`, onde
 * cada instância só lia o próprio estado).
 *
 * NÃO é fonte de autoridade: nome/SKU aqui são só conveniência de exibição —
 * o servidor (`POST /api/contact`, `subject: "cart"`) RE-RESOLVE tudo de novo
 * a partir do `slug` no submit (ver `src/app/api/contact/route.ts`). Um
 * `localStorage` adulterado só pode, no pior caso, mandar um slug que o
 * servidor não encontra (e a resposta é `cart_empty`) — nunca envenenar o
 * lead com nome/preço forjados.
 *
 * `MAX_CART_ITEMS`/`MAX_CART_ITEM_QUANTITY` vêm de `@/server/lib/contact-submit`
 * — módulo SEM `server-only` (é importado por Client Components como
 * `contact-form.tsx`/`catalog-form.ts` desde 2026-08-24), então é seguro
 * reaproveitar os mesmos tetos aqui em vez de duplicá-los.
 */
import { MAX_CART_ITEMS, MAX_CART_ITEM_QUANTITY } from "@/server/lib/contact-submit";
import { useSyncExternalStore } from "react";

export type CartItem = {
  slug: string;
  name: string;
  sku: string;
  quantity: number;
  /** Foto de capa para a miniatura da lista (opcional: itens gravados antes
   *  da spec 001 não têm, e continuam válidos). Só exibição — o servidor
   *  nunca lê este campo. */
  image?: string;
};

/** O que `addItem` recebe — a quantidade é um parâmetro separado (padrão 1). */
export type NewCartItem = Omit<CartItem, "quantity">;

const STORAGE_KEY = "roco_cart_v1";

/**
 * Snapshot vazio para SSR/pré-hidratação — CONGELADO e reaproveitado sempre
 * pela MESMA referência (nunca `[]` novo a cada chamada). `useSyncExternalStore`
 * exige que `getServerSnapshot` seja estável entre chamadas; devolver um array
 * novo a cada render causaria um loop de re-render (a mesma classe de bug já
 * evitada em `ConsentBanner`, ali com uma string em vez de array).
 */
const EMPTY_CART: readonly CartItem[] = Object.freeze([]);

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function clampQuantity(quantity: number): number {
  const rounded = Math.floor(quantity);
  if (!Number.isFinite(rounded) || rounded <= 0) return 0;
  return Math.min(rounded, MAX_CART_ITEM_QUANTITY);
}

/** Espaço, caractere de controle ou `\` — o parser de URL do navegador ignora/normaliza. */
function hasUnsafeUrlChars(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f || char === "\\") return true;
  }
  return false;
}

/**
 * Aceita só URL http(s) com host ou caminho interno como imagem — um
 * `localStorage` adulterado não pode injetar `javascript:`/`data:` num `src`.
 * Espaço, controle e `\` barrados em qualquer posição: `/\evil.com/x.png`,
 * `/<TAB>/evil.com` e `/<LF>/evil.com` PARECEM caminho interno, mas o
 * navegador os resolve para outro host (revisão de segurança 2026-09-30).
 */
export function sanitizeImage(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048 || hasUnsafeUrlChars(value)) return undefined;
  if (value.startsWith("/")) return value.startsWith("//") ? undefined : value;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.host ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Valida e normaliza UM item cru do `localStorage`. `null` = descartar. */
function sanitizeItem(value: unknown): CartItem | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const { slug, name, sku, quantity, image } = record;

  if (typeof slug !== "string" || slug.trim() === "") return null;
  if (typeof name !== "string" || typeof sku !== "string") return null;
  if (typeof quantity !== "number") return null;

  const safeQuantity = clampQuantity(quantity);
  if (safeQuantity <= 0) return null;

  const safeImage = sanitizeImage(image);
  return safeImage
    ? { slug, name, sku, quantity: safeQuantity, image: safeImage }
    : { slug, name, sku, quantity: safeQuantity };
}

/**
 * Lê e valida o `localStorage` bruto. NUNCA lança — JSON corrompido, forjado
 * à mão, ou de uma versão futura do schema vira carrinho vazio (mesmo
 * critério defensivo de `readUtmCookie` em `@/shared/lib/lead-origin`).
 */
function readRaw(): CartItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeItem)
      .filter((item): item is CartItem => item !== null);
  } catch {
    return [];
  }
}

function persist(items: CartItem[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Quota excedida, modo privado sem storage, etc. — perde persistência
    // entre recargas, nunca lança (o carrinho continua funcionando em
    // memória até o próximo reload).
  }
}

// ---------------------------------------------------------------------------
// Lógica PURA de mutação — separada de qualquer I/O (localStorage/window) para
// ser testável isoladamente pelo `tester`, sem precisar simular o browser.
// ---------------------------------------------------------------------------

/**
 * Adiciona um item (soma a quantidade se o slug já existir). Teto de
 * `MAX_CART_ITEMS` itens DISTINTOS: um slug NOVO quando já há o teto de itens
 * é NO-OP SILENCIOSO (devolve a MESMA referência de `items`, sem lançar nem
 * truncar a lista) — o caller (`addItem`) usa a identidade de referência para
 * saber se a operação teve efeito e reportar sucesso/falha ao componente.
 */
export function applyAddItem(items: CartItem[], item: NewCartItem, quantityToAdd: number): CartItem[] {
  const existingIndex = items.findIndex((current) => current.slug === item.slug);

  if (existingIndex === -1) {
    if (items.length >= MAX_CART_ITEMS) return items;
    const quantity = clampQuantity(quantityToAdd);
    if (quantity <= 0) return items;
    const next: CartItem = { slug: item.slug, name: item.name, sku: item.sku, quantity };
    const image = sanitizeImage(item.image);
    if (image) next.image = image;
    return [...items, next];
  }

  const existing = items[existingIndex];
  const nextQuantity = clampQuantity(existing.quantity + quantityToAdd);
  if (nextQuantity === existing.quantity) return items;

  const next = [...items];
  next[existingIndex] = { ...existing, quantity: nextQuantity };
  return next;
}

/** Define a quantidade de um item; remove a linha se `quantity <= 0`. */
export function applySetQuantity(items: CartItem[], slug: string, quantity: number): CartItem[] {
  const safeQuantity = clampQuantity(quantity);
  if (safeQuantity <= 0) {
    return items.filter((current) => current.slug !== slug);
  }
  return items.map((current) =>
    current.slug === slug ? { ...current, quantity: safeQuantity } : current
  );
}

export function applyRemoveItem(items: CartItem[], slug: string): CartItem[] {
  return items.filter((current) => current.slug !== slug);
}

// ---------------------------------------------------------------------------
// Store singleton — cache em memória + persistência + notificação.
// ---------------------------------------------------------------------------

let cachedItems: CartItem[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated(): void {
  if (hydrated) return;
  cachedItems = readRaw();
  hydrated = true;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function commit(next: CartItem[]): void {
  cachedItems = next;
  persist(next);
  notify();
}

/** Sincronização entre ABAS: o evento `storage` só dispara nas OUTRAS abas
 *  (nunca na que fez a escrita) — sem isto, duas abas do carrinho aberto
 *  divergiriam silenciosamente. Registrado uma única vez, no module scope. */
if (isBrowser()) {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    cachedItems = readRaw();
    notify();
  });
}

/** Lê o carrinho atual fora de React (handlers de evento, outras libs). */
export function getCart(): CartItem[] {
  ensureHydrated();
  return cachedItems;
}

/**
 * Adiciona `quantity` unidades de um item (padrão 1). Devolve `true` quando a
 * operação teve efeito, `false` quando foi um no-op silencioso (teto de
 * `MAX_CART_ITEMS` itens distintos atingido, ou quantidade inválida) — o
 * caller pode ignorar o retorno (o botão de "adicionar" não bloqueia hoje) ou
 * usá-lo para feedback futuro.
 */
export function addItem(item: NewCartItem, quantity = 1): boolean {
  ensureHydrated();
  const next = applyAddItem(cachedItems, item, quantity);
  if (next === cachedItems) return false;
  commit(next);
  return true;
}

export function setQuantity(slug: string, quantity: number): void {
  ensureHydrated();
  commit(applySetQuantity(cachedItems, slug, quantity));
}

export function removeItem(slug: string): void {
  ensureHydrated();
  commit(applyRemoveItem(cachedItems, slug));
}

export function clearCart(): void {
  ensureHydrated();
  if (cachedItems.length === 0) return;
  commit([]);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getItemsSnapshot(): readonly CartItem[] {
  ensureHydrated();
  return cachedItems;
}

function getItemsServerSnapshot(): readonly CartItem[] {
  return EMPTY_CART;
}

function getCountSnapshot(): number {
  ensureHydrated();
  return cachedItems.reduce((sum, item) => sum + item.quantity, 0);
}

function getCountServerSnapshot(): number {
  return 0;
}

/** Itens do carrinho — reativo, sincroniza entre abas. */
export function useCartItems(): readonly CartItem[] {
  return useSyncExternalStore(subscribe, getItemsSnapshot, getItemsServerSnapshot);
}

/** Soma das quantidades — para o badge do ícone de carrinho na nav. */
export function useCartCount(): number {
  return useSyncExternalStore(subscribe, getCountSnapshot, getCountServerSnapshot);
}
