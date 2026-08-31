import { describe, it, expect } from "vitest";
import {
  applyAddItem,
  applySetQuantity,
  applyRemoveItem,
  type CartItem,
  type NewCartItem,
} from "./cart-store";
import { MAX_CART_ITEMS, MAX_CART_ITEM_QUANTITY } from "@/server/lib/contact-submit";

const createItem = (overrides?: Partial<NewCartItem>): NewCartItem => ({
  slug: "test-item",
  name: "Test Product",
  sku: "TEST-001",
  ...overrides,
});

const createCartItem = (overrides?: Partial<CartItem>): CartItem => ({
  slug: "test-item",
  name: "Test Product",
  sku: "TEST-001",
  quantity: 1,
  ...overrides,
});

describe("applyAddItem", () => {
  describe("adding to empty cart", () => {
    it("adds a new item with quantity", () => {
      const result = applyAddItem([], createItem(), 1);
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe("test-item");
      expect(result[0].quantity).toBe(1);
    });

    it("clamps quantity to MAX_CART_ITEM_QUANTITY if exceeded", () => {
      const result = applyAddItem([], createItem(), MAX_CART_ITEM_QUANTITY + 1);
      expect(result[0].quantity).toBe(MAX_CART_ITEM_QUANTITY);
    });

    it("returns NO-OP (same reference) when already at MAX_CART_ITEMS", () => {
      const full = Array.from({ length: MAX_CART_ITEMS }, (_, i) =>
        createCartItem({ slug: `item-${i}` })
      );
      const result = applyAddItem(full, createItem({ slug: "new-item" }), 1);
      expect(result).toBe(full); // Same reference
      expect(result).toHaveLength(MAX_CART_ITEMS);
    });

    it("returns NO-OP (same reference) when quantity is invalid (negative)", () => {
      const cart: CartItem[] = [];
      const result = applyAddItem(cart, createItem(), -5);
      expect(result).toBe(cart);
    });

    it("returns NO-OP (same reference) when quantity is zero", () => {
      const cart: CartItem[] = [];
      const result = applyAddItem(cart, createItem(), 0);
      expect(result).toBe(cart);
    });

    it("returns NO-OP (same reference) when quantity is NaN", () => {
      const cart: CartItem[] = [];
      const result = applyAddItem(cart, createItem(), NaN);
      expect(result).toBe(cart);
    });

    it("returns NO-OP (same reference) when quantity is Infinity", () => {
      const cart: CartItem[] = [];
      const result = applyAddItem(cart, createItem(), Infinity);
      expect(result).toBe(cart);
    });

    it("truncates fractional quantities via Math.floor", () => {
      const result = applyAddItem([], createItem(), 3.7);
      expect(result[0].quantity).toBe(3);
    });

    it("accepts quantity of 1 (default)", () => {
      const result = applyAddItem([], createItem(), 1);
      expect(result[0].quantity).toBe(1);
    });

    it("accepts quantity at MAX_CART_ITEM_QUANTITY boundary", () => {
      const result = applyAddItem([], createItem(), MAX_CART_ITEM_QUANTITY);
      expect(result[0].quantity).toBe(MAX_CART_ITEM_QUANTITY);
    });
  });

  describe("adding to existing cart (same slug)", () => {
    it("sums quantities when slug already exists", () => {
      const cart = [createCartItem({ quantity: 5 })];
      const result = applyAddItem(cart, createItem(), 3);
      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(8);
    });

    it("sums quantities without exceeding MAX_CART_ITEM_QUANTITY", () => {
      const cart = [createCartItem({ quantity: 9995 })];
      const result = applyAddItem(cart, createItem(), 10);
      expect(result[0].quantity).toBe(MAX_CART_ITEM_QUANTITY);
    });

    it("returns SAME REFERENCE when sum equals current quantity", () => {
      const cart = [createCartItem({ quantity: 5 })];
      const result = applyAddItem(cart, createItem(), 0);
      expect(result).toBe(cart); // No change = same reference
    });

    it("returns NEW ARRAY when sum changes", () => {
      const cart = [createCartItem({ quantity: 5 })];
      const result = applyAddItem(cart, createItem(), 3);
      expect(result).not.toBe(cart); // Changed = new reference
      expect(result).toHaveLength(1);
    });

    it("does not mutate the original array", () => {
      const original = [createCartItem({ quantity: 5 })];
      const originalQuantity = original[0].quantity;
      applyAddItem(original, createItem(), 3);
      expect(original[0].quantity).toBe(originalQuantity);
    });

    it("does not mutate the original item object", () => {
      const cart = [createCartItem({ quantity: 5 })];
      const originalItem = { ...cart[0] };
      applyAddItem(cart, createItem(), 3);
      expect(cart[0]).toEqual(originalItem); // Original unchanged
    });
  });

  describe("adding to multi-item cart", () => {
    it("appends a new item without affecting others", () => {
      const cart = [
        createCartItem({ slug: "item-1", quantity: 2 }),
        createCartItem({ slug: "item-2", quantity: 3 }),
      ];
      const result = applyAddItem(cart, createItem({ slug: "item-3" }), 1);
      expect(result).toHaveLength(3);
      expect(result[0].quantity).toBe(2);
      expect(result[1].quantity).toBe(3);
      expect(result[2].slug).toBe("item-3");
    });

    it("updates quantity of an existing middle item", () => {
      const cart = [
        createCartItem({ slug: "item-1", quantity: 1 }),
        createCartItem({ slug: "item-2", quantity: 2 }),
        createCartItem({ slug: "item-3", quantity: 3 }),
      ];
      const result = applyAddItem(cart, createItem({ slug: "item-2" }), 5);
      expect(result).toHaveLength(3);
      expect(result[1].quantity).toBe(7);
      expect(result[0].quantity).toBe(1);
      expect(result[2].quantity).toBe(3);
    });

    it("respects MAX_CART_ITEMS when adding to a full cart", () => {
      const full = Array.from({ length: MAX_CART_ITEMS }, (_, i) =>
        createCartItem({ slug: `item-${i}`, quantity: 1 })
      );
      const result = applyAddItem(full, createItem({ slug: `item-${MAX_CART_ITEMS}` }), 1);
      expect(result).toBe(full); // NO-OP
      expect(result).toHaveLength(MAX_CART_ITEMS);
    });

    it("can add to a cart that has (MAX_CART_ITEMS - 1) items", () => {
      const almost = Array.from({ length: MAX_CART_ITEMS - 1 }, (_, i) =>
        createCartItem({ slug: `item-${i}` })
      );
      const result = applyAddItem(almost, createItem({ slug: `item-final` }), 1);
      expect(result).toHaveLength(MAX_CART_ITEMS);
      expect(result).not.toBe(almost);
    });
  });

  describe("quantity clamping edge cases", () => {
    it("clamps -Infinity to 0 (no-op)", () => {
      const cart: CartItem[] = [];
      const result = applyAddItem(cart, createItem(), -Infinity);
      expect(result).toBe(cart);
    });

    it("clamps a very large number", () => {
      const result = applyAddItem([], createItem(), 999999999);
      expect(result[0].quantity).toBe(MAX_CART_ITEM_QUANTITY);
    });

    it("handles float quantities by flooring before clamping", () => {
      const result = applyAddItem([], createItem(), 5.99);
      expect(result[0].quantity).toBe(5);
    });
  });
});

describe("applySetQuantity", () => {
  describe("setting quantity on existing item", () => {
    it("sets quantity to the specified value", () => {
      const cart = [createCartItem({ slug: "item-1", quantity: 5 })];
      const result = applySetQuantity(cart, "item-1", 10);
      expect(result[0].quantity).toBe(10);
    });

    it("clamps quantity to MAX_CART_ITEM_QUANTITY", () => {
      const cart = [createCartItem({ quantity: 1 })];
      const result = applySetQuantity(cart, "test-item", MAX_CART_ITEM_QUANTITY + 100);
      expect(result[0].quantity).toBe(MAX_CART_ITEM_QUANTITY);
    });

    it("removes item when quantity is set to 0", () => {
      const cart = [createCartItem({ quantity: 5 })];
      const result = applySetQuantity(cart, "test-item", 0);
      expect(result).toHaveLength(0);
    });

    it("removes item when quantity is set to negative", () => {
      const cart = [createCartItem({ quantity: 5 })];
      const result = applySetQuantity(cart, "test-item", -10);
      expect(result).toHaveLength(0);
    });

    it("returns a new array (even when quantity is unchanged)", () => {
      const cart = [createCartItem({ quantity: 5 })];
      const result = applySetQuantity(cart, "test-item", 5);
      expect(result).not.toBe(cart); // Always new reference via map()
      expect(result[0].quantity).toBe(5);
    });

    it("returns a new array when quantity changes", () => {
      const cart = [createCartItem({ quantity: 5 })];
      const result = applySetQuantity(cart, "test-item", 10);
      expect(result).not.toBe(cart);
      expect(result[0].quantity).toBe(10);
    });

    it("does not mutate the original item", () => {
      const cart = [createCartItem({ quantity: 5 })];
      const original = { ...cart[0] };
      applySetQuantity(cart, "test-item", 10);
      expect(cart[0]).toEqual(original);
    });

    it("truncates fractional quantities", () => {
      const cart = [createCartItem({ quantity: 1 })];
      const result = applySetQuantity(cart, "test-item", 3.7);
      expect(result[0].quantity).toBe(3);
    });

    it("handles NaN by treating it as invalid (≤0)", () => {
      const cart = [createCartItem({ quantity: 5 })];
      const result = applySetQuantity(cart, "test-item", NaN);
      expect(result).toHaveLength(0); // Removed
    });

    it("handles Infinity by treating it as invalid (removes item)", () => {
      const cart = [createCartItem({ quantity: 1 })];
      const result = applySetQuantity(cart, "test-item", Infinity);
      // Infinity is not finite, so it's treated as 0 and item is removed
      expect(result).toHaveLength(0);
    });
  });

  describe("setting quantity on non-existent item", () => {
    it("returns the same items when slug does not exist and quantity is positive", () => {
      const cart = [createCartItem({ slug: "item-1" })];
      const result = applySetQuantity(cart, "nonexistent", 5);
      // New array returned, but same items
      expect(result).not.toBe(cart); // Always new reference via map()
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(cart[0]);
    });

    it("returns the same items when slug does not exist and quantity is 0", () => {
      const cart = [createCartItem({ slug: "item-1" })];
      const result = applySetQuantity(cart, "nonexistent", 0);
      // No change since slug not found and can't remove nonexistent
      expect(result).not.toBe(cart); // New reference via filter()
      expect(result).toHaveLength(1);
    });
  });

  describe("setting quantity on multi-item cart", () => {
    it("updates one item without affecting others", () => {
      const cart = [
        createCartItem({ slug: "item-1", quantity: 2 }),
        createCartItem({ slug: "item-2", quantity: 3 }),
        createCartItem({ slug: "item-3", quantity: 4 }),
      ];
      const result = applySetQuantity(cart, "item-2", 10);
      expect(result).toHaveLength(3);
      expect(result[0].quantity).toBe(2);
      expect(result[1].quantity).toBe(10);
      expect(result[2].quantity).toBe(4);
    });

    it("removes one item when quantity is 0, keeps others", () => {
      const cart = [
        createCartItem({ slug: "item-1", quantity: 1 }),
        createCartItem({ slug: "item-2", quantity: 2 }),
        createCartItem({ slug: "item-3", quantity: 3 }),
      ];
      const result = applySetQuantity(cart, "item-2", 0);
      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe("item-1");
      expect(result[1].slug).toBe("item-3");
    });

    it("removes the first item when quantity is 0", () => {
      const cart = [
        createCartItem({ slug: "item-1", quantity: 1 }),
        createCartItem({ slug: "item-2", quantity: 2 }),
      ];
      const result = applySetQuantity(cart, "item-1", 0);
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe("item-2");
    });

    it("removes the last item when quantity is 0", () => {
      const cart = [
        createCartItem({ slug: "item-1", quantity: 1 }),
        createCartItem({ slug: "item-2", quantity: 2 }),
      ];
      const result = applySetQuantity(cart, "item-2", 0);
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe("item-1");
    });
  });

  describe("idempotence", () => {
    it("setting the same quantity twice produces the same result", () => {
      const cart = [createCartItem({ quantity: 5 })];
      const result1 = applySetQuantity(cart, "test-item", 5);
      const result2 = applySetQuantity(result1, "test-item", 5);
      // Same content
      expect(result2[0].quantity).toBe(5);
      expect(result2[0].slug).toBe("test-item");
    });
  });
});

describe("applyRemoveItem", () => {
  describe("removing from single-item cart", () => {
    it("removes the only item", () => {
      const cart = [createCartItem()];
      const result = applyRemoveItem(cart, "test-item");
      expect(result).toHaveLength(0);
    });

    it("returns empty cart when slug matches", () => {
      const cart = [createCartItem({ slug: "test-item" })];
      const result = applyRemoveItem(cart, "test-item");
      expect(result).toHaveLength(0);
    });

    it("returns the same items when slug does not match", () => {
      const cart = [createCartItem({ slug: "item-1" })];
      const result = applyRemoveItem(cart, "different-item");
      // New reference via filter(), but same items
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe("item-1");
    });
  });

  describe("removing from multi-item cart", () => {
    it("removes the first item", () => {
      const cart = [
        createCartItem({ slug: "item-1", quantity: 1 }),
        createCartItem({ slug: "item-2", quantity: 2 }),
        createCartItem({ slug: "item-3", quantity: 3 }),
      ];
      const result = applyRemoveItem(cart, "item-1");
      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe("item-2");
      expect(result[1].slug).toBe("item-3");
    });

    it("removes the middle item", () => {
      const cart = [
        createCartItem({ slug: "item-1", quantity: 1 }),
        createCartItem({ slug: "item-2", quantity: 2 }),
        createCartItem({ slug: "item-3", quantity: 3 }),
      ];
      const result = applyRemoveItem(cart, "item-2");
      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe("item-1");
      expect(result[1].slug).toBe("item-3");
    });

    it("removes the last item", () => {
      const cart = [
        createCartItem({ slug: "item-1", quantity: 1 }),
        createCartItem({ slug: "item-2", quantity: 2 }),
        createCartItem({ slug: "item-3", quantity: 3 }),
      ];
      const result = applyRemoveItem(cart, "item-3");
      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe("item-1");
      expect(result[1].slug).toBe("item-2");
    });

    it("does not modify other items", () => {
      const cart = [
        createCartItem({ slug: "item-1", quantity: 1 }),
        createCartItem({ slug: "item-2", quantity: 2 }),
        createCartItem({ slug: "item-3", quantity: 3 }),
      ];
      const result = applyRemoveItem(cart, "item-2");
      expect(result[0]).toEqual(cart[0]);
      expect(result[1]).toEqual(cart[2]);
    });

    it("returns same items when slug does not exist", () => {
      const cart = [createCartItem({ slug: "item-1" })];
      const result = applyRemoveItem(cart, "nonexistent");
      // New reference via filter(), but same items
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe("item-1");
    });

    it("returns a new array when an item is removed", () => {
      const cart = [
        createCartItem({ slug: "item-1" }),
        createCartItem({ slug: "item-2" }),
      ];
      const result = applyRemoveItem(cart, "item-1");
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe("item-2");
    });
  });

  describe("removing from empty cart", () => {
    it("returns empty cart when cart is empty", () => {
      const cart: CartItem[] = [];
      const result = applyRemoveItem(cart, "test-item");
      // New reference via filter(), but empty
      expect(result).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("handles removing with an empty slug (no match)", () => {
      const cart = [createCartItem({ slug: "item-1" })];
      const result = applyRemoveItem(cart, "");
      // Empty slug doesn't match "item-1"
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe("item-1");
    });

    it("does not mutate the original array", () => {
      const original = [
        createCartItem({ slug: "item-1" }),
        createCartItem({ slug: "item-2" }),
      ];
      const originalLength = original.length;
      applyRemoveItem(original, "item-1");
      expect(original).toHaveLength(originalLength);
    });
  });

  describe("multiple removals", () => {
    it("can remove multiple items in sequence", () => {
      let cart = [
        createCartItem({ slug: "item-1" }),
        createCartItem({ slug: "item-2" }),
        createCartItem({ slug: "item-3" }),
      ];
      cart = applyRemoveItem(cart, "item-1");
      expect(cart).toHaveLength(2);
      cart = applyRemoveItem(cart, "item-3");
      expect(cart).toHaveLength(1);
      expect(cart[0].slug).toBe("item-2");
    });
  });
});
