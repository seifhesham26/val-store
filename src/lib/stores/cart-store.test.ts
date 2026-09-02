import { describe, it, expect, beforeEach } from "vitest";
import {
  useCartStore,
  GUEST_CART_ITEM_ID_PREFIX,
  type CartItem,
} from "./cart-store";

/**
 * The store persists `items` to localStorage under `valkyrie-cart-v2`, and no
 * sign-out path used to clear it. Because every sign-out finishes with a full
 * page load, the next person on a shared browser rehydrated the previous
 * account's cart from disk before any session check had run.
 *
 * These cover the store half of that fix. The three sign-out handlers and the
 * provider backstop are components, and go in the manual test plan.
 */
const line = (overrides: Partial<CartItem> = {}): CartItem => ({
  id: "line-1",
  productId: "prod-1",
  variantId: "var-1",
  variantLabel: "M / Black",
  productName: "Shirt",
  productPrice: 100,
  productImage: null,
  quantity: 1,
  maxStock: 5,
  ...overrides,
});

describe("cart store", () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  it("clearCart empties the cart", () => {
    useCartStore.getState().setItems([line(), line({ id: "line-2" })]);
    expect(useCartStore.getState().items).toHaveLength(2);

    useCartStore.getState().clearCart();

    expect(useCartStore.getState().items).toEqual([]);
    expect(useCartStore.getState().isEmpty()).toBe(true);
    expect(useCartStore.getState().getItemCount()).toBe(0);
  });

  it("clearCart leaves nothing that could belong to a previous account", () => {
    useCartStore.getState().setItems([line({ productName: "Private" })]);
    useCartStore.getState().clearCart();

    const serialized = JSON.stringify(useCartStore.getState().items);
    expect(serialized).not.toContain("Private");
  });

  it("getSubtotal reflects quantity and price", () => {
    useCartStore
      .getState()
      .setItems([line({ productPrice: 100, quantity: 2 })]);
    expect(useCartStore.getState().getSubtotal()).toBe(200);
  });

  it("counts every unit, not every line", () => {
    useCartStore
      .getState()
      .setItems([
        line({ quantity: 2 }),
        line({ id: "line-2", variantId: "var-2", quantity: 3 }),
      ]);

    expect(useCartStore.getState().getItemCount()).toBe(5);
  });

  describe("clearSignedOutItems", () => {
    it("drops server-synced lines but keeps unmerged guest lines", () => {
      useCartStore.getState().setItems([
        line({ id: "server-line-1", productName: "Previous account's item" }),
        line({
          id: `${GUEST_CART_ITEM_ID_PREFIX}abc`,
          productName: "Not synced yet",
        }),
      ]);

      useCartStore.getState().clearSignedOutItems();

      const remaining = useCartStore.getState().items;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].productName).toBe("Not synced yet");
    });

    it("leaves nothing that could belong to a previous account when there is no guest line", () => {
      useCartStore.getState().setItems([line({ productName: "Private" })]);
      useCartStore.getState().clearSignedOutItems();

      const serialized = JSON.stringify(useCartStore.getState().items);
      expect(serialized).not.toContain("Private");
    });
  });
});
