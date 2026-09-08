import { describe, it, expect } from "vitest";
import {
  MAX_LINE_QUANTITY,
  quantityInCart,
  remainingCapacity,
} from "./cart-stock-limit";

const PRODUCT = "product-1";
const OTHER_PRODUCT = "product-2";
const VARIANT_M = "variant-m";
const VARIANT_L = "variant-l";

function line(productId: string, variantId: string | null, quantity: number) {
  return { productId, variantId, quantity };
}

describe("quantityInCart", () => {
  it("returns 0 when the product is not in the cart", () => {
    expect(quantityInCart([], PRODUCT, VARIANT_M)).toBe(0);
  });

  it("finds the quantity for a matching product and variant", () => {
    expect(
      quantityInCart([line(PRODUCT, VARIANT_M, 3)], PRODUCT, VARIANT_M)
    ).toBe(3);
  });

  it("treats two variants of one product as separate lines", () => {
    const items = [line(PRODUCT, VARIANT_M, 3), line(PRODUCT, VARIANT_L, 4)];
    expect(quantityInCart(items, PRODUCT, VARIANT_M)).toBe(3);
    expect(quantityInCart(items, PRODUCT, VARIANT_L)).toBe(4);
  });

  it("ignores other products", () => {
    expect(
      quantityInCart([line(OTHER_PRODUCT, VARIANT_M, 9)], PRODUCT, VARIANT_M)
    ).toBe(0);
  });

  it("matches a variant-less product on a null variantId", () => {
    const items = [line(PRODUCT, null, 2)];
    expect(quantityInCart(items, PRODUCT, null)).toBe(2);
    expect(quantityInCart(items, PRODUCT, VARIANT_M)).toBe(0);
  });

  it("sums duplicate lines rather than picking one", () => {
    // An optimistic `pending-` line can briefly coexist with the server line
    // it is about to be replaced by. Counting one of them would under-report
    // what is held and let the customer over-add.
    const items = [line(PRODUCT, VARIANT_M, 2), line(PRODUCT, VARIANT_M, 1)];
    expect(quantityInCart(items, PRODUCT, VARIANT_M)).toBe(3);
  });
});

describe("remainingCapacity", () => {
  it("leaves two when three of a five-stock item are already in the cart", () => {
    // The case that motivated the whole feature.
    expect(remainingCapacity(5, 3)).toBe(2);
  });

  it("returns the full stock for an empty cart", () => {
    expect(remainingCapacity(5, 0)).toBe(5);
  });

  it("returns zero once the cart holds all the stock", () => {
    expect(remainingCapacity(5, 5)).toBe(0);
  });

  it("clamps to zero rather than going negative when stock moved underneath us", () => {
    expect(remainingCapacity(2, 5)).toBe(0);
  });

  it("returns zero for a sold-out variant", () => {
    expect(remainingCapacity(0, 0)).toBe(0);
  });

  it("falls back to the per-line cap when live stock is unknown", () => {
    // No figure available: the server stays the sole authority on stock, but
    // the request still has to satisfy the router's `MAX_LINE_QUANTITY` bound.
    expect(remainingCapacity(null, 0)).toBe(MAX_LINE_QUANTITY);
    expect(remainingCapacity(null, 40)).toBe(MAX_LINE_QUANTITY - 40);
  });

  it("caps a high-stock product at the per-line limit", () => {
    // `cart.add` rejects a quantity above MAX_LINE_QUANTITY in Zod, so a
    // ceiling of 500 would produce a request the server refuses to parse.
    expect(remainingCapacity(500, 0)).toBe(MAX_LINE_QUANTITY);
    expect(remainingCapacity(500, 95)).toBe(5);
  });

  it("the thirty-first press has nowhere to go", () => {
    // The single assertion that says this feature works: with all 30 units in
    // the cart there is no capacity left, so the call site never fires.
    const inCart = quantityInCart(
      [line(PRODUCT, VARIANT_M, 30)],
      PRODUCT,
      VARIANT_M
    );
    expect(remainingCapacity(30, inCart)).toBe(0);
  });
});
