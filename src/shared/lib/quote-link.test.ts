import { describe, expect, it } from "vitest";
import { MAX_CART_ITEMS, MAX_CART_ITEM_QUANTITY } from "@/server/lib/contact-submit";
import { encodeQuoteItems, parseQuoteItems } from "@/shared/lib/quote-link";

describe("parseQuoteItems", () => {
  it("lê slug:quantidade separados por vírgula", () => {
    expect(parseQuoteItems("flexivel-gas:2,registro-1-2:1")).toEqual([
      { slug: "flexivel-gas", quantity: 2 },
      { slug: "registro-1-2", quantity: 1 },
    ]);
  });

  it("sem quantidade vale 1; quantidade inválida vira 1; teto de quantidade", () => {
    expect(parseQuoteItems(`a,b:abc,c:0,d:${MAX_CART_ITEM_QUANTITY + 5}`)).toEqual([
      { slug: "a", quantity: 1 },
      { slug: "b", quantity: 1 },
      { slug: "c", quantity: 1 },
      { slug: "d", quantity: MAX_CART_ITEM_QUANTITY },
    ]);
  });

  it("ignora slug fora do padrão e soma repetidos", () => {
    expect(parseQuoteItems("../x:2,a b:1,ok:2,ok:3, :1,<script>:1")).toEqual([{ slug: "ok", quantity: 5 }]);
  });

  it("limita a MAX_CART_ITEMS itens distintos e aceita vazio/array", () => {
    const many = Array.from({ length: MAX_CART_ITEMS + 5 }, (_, i) => `p${i}:1`).join(",");
    expect(parseQuoteItems(many)).toHaveLength(MAX_CART_ITEMS);
    expect(parseQuoteItems(undefined)).toEqual([]);
    expect(parseQuoteItems(["a:1", "b:2"])).toEqual([
      { slug: "a", quantity: 1 },
      { slug: "b", quantity: 2 },
    ]);
  });
});

describe("encodeQuoteItems", () => {
  it("é o inverso de parseQuoteItems", () => {
    const items = [
      { slug: "flexivel-gas", quantity: 2 },
      { slug: "registro", quantity: 10 },
    ];
    expect(encodeQuoteItems(items)).toBe("flexivel-gas:2,registro:10");
    expect(parseQuoteItems(encodeQuoteItems(items))).toEqual(items);
  });
});
