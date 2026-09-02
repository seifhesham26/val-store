import { describe, it, expect } from "vitest";
import {
  mergeGuestCartItems,
  type GuestCartLine,
  type ServerCartLine,
} from "./guest-cart-merge";

const PRODUCT_A = "aaaaaaaa-0000-0000-0000-000000000001";
const PRODUCT_B = "bbbbbbbb-0000-0000-0000-000000000002";
const VARIANT_M = "mmmmmmmm-0000-0000-0000-000000000001";
const VARIANT_L = "llllllll-0000-0000-0000-000000000001";

const guestLine = (overrides: Partial<GuestCartLine> = {}): GuestCartLine => ({
  productId: PRODUCT_A,
  variantId: VARIANT_M,
  quantity: 1,
  ...overrides,
});

const serverLine = (
  overrides: Partial<ServerCartLine> = {}
): ServerCartLine => ({
  id: "server-line-1",
  productId: PRODUCT_A,
  variantId: VARIANT_M,
  quantity: 1,
  ...overrides,
});

describe("mergeGuestCartItems", () => {
  it("sums duplicate productId+variantId guest lines into one", () => {
    const merged = mergeGuestCartItems(
      [],
      [guestLine({ quantity: 2 }), guestLine({ quantity: 3 })],
      () => 100
    );

    expect(merged).toEqual([
      {
        productId: PRODUCT_A,
        variantId: VARIANT_M,
        existingId: null,
        quantity: 5,
      },
    ]);
  });

  it("sums a guest line into a matching existing server line", () => {
    const merged = mergeGuestCartItems(
      [serverLine({ id: "srv-1", quantity: 2 })],
      [guestLine({ quantity: 3 })],
      () => 100
    );

    expect(merged).toEqual([
      {
        productId: PRODUCT_A,
        variantId: VARIANT_M,
        existingId: "srv-1",
        quantity: 5,
      },
    ]);
  });

  it("caps the summed quantity at available stock", () => {
    const merged = mergeGuestCartItems(
      [serverLine({ id: "srv-1", quantity: 4 })],
      [guestLine({ quantity: 4 })],
      () => 5
    );

    expect(merged).toEqual([
      {
        productId: PRODUCT_A,
        variantId: VARIANT_M,
        existingId: "srv-1",
        quantity: 5,
      },
    ]);
  });

  it("drops a line entirely when its stock has run out", () => {
    const merged = mergeGuestCartItems(
      [],
      [guestLine({ quantity: 2 })],
      () => 0
    );

    expect(merged).toEqual([]);
  });

  it("returns nothing for an empty guest cart, leaving server lines untouched", () => {
    const merged = mergeGuestCartItems(
      [serverLine({ id: "srv-1", quantity: 2 })],
      [],
      () => 100
    );

    expect(merged).toEqual([]);
  });

  it("returns straight inserts for an empty server cart", () => {
    const merged = mergeGuestCartItems(
      [],
      [
        guestLine({ productId: PRODUCT_A, variantId: VARIANT_M, quantity: 1 }),
        guestLine({ productId: PRODUCT_B, variantId: VARIANT_L, quantity: 2 }),
      ],
      () => 100
    );

    expect(merged).toHaveLength(2);
    expect(merged.every((line) => line.existingId === null)).toBe(true);
    expect(merged.find((l) => l.productId === PRODUCT_B)?.quantity).toBe(2);
  });

  it("treats a variant-less line (variantId null) as its own identity", () => {
    const merged = mergeGuestCartItems(
      [
        serverLine({
          id: "srv-1",
          productId: PRODUCT_A,
          variantId: null,
          quantity: 1,
        }),
      ],
      [
        guestLine({ productId: PRODUCT_A, variantId: null, quantity: 1 }),
        // A variant-bearing line for the same product must not merge with it.
        guestLine({ productId: PRODUCT_A, variantId: VARIANT_M, quantity: 1 }),
      ],
      () => 100
    );

    expect(merged).toHaveLength(2);
    const variantLess = merged.find((l) => l.variantId === null);
    expect(variantLess).toEqual({
      productId: PRODUCT_A,
      variantId: null,
      existingId: "srv-1",
      quantity: 2,
    });
  });

  it("ignores a non-positive guest quantity", () => {
    const merged = mergeGuestCartItems(
      [],
      [guestLine({ quantity: 0 }), guestLine({ quantity: -1 })],
      () => 100
    );

    expect(merged).toEqual([]);
  });

  it("passes the correct line identity to stockFor for each key", () => {
    type CartLineIdentityArg = { productId: string; variantId: string | null };
    const seen: CartLineIdentityArg[] = [];

    mergeGuestCartItems(
      [],
      [
        guestLine({ productId: PRODUCT_A, variantId: VARIANT_M, quantity: 1 }),
        guestLine({ productId: PRODUCT_A, variantId: VARIANT_L, quantity: 1 }),
      ],
      (line) => {
        seen.push(line);
        return 10;
      }
    );

    expect(seen).toEqual(
      expect.arrayContaining([
        { productId: PRODUCT_A, variantId: VARIANT_M },
        { productId: PRODUCT_A, variantId: VARIANT_L },
      ])
    );
  });
});
