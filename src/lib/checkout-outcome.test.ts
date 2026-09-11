import { describe, it, expect } from "vitest";
import {
  resolveCheckoutOutcome,
  shouldClearCartOnArrival,
} from "./checkout-outcome";

describe("resolveCheckoutOutcome", () => {
  it("is placed on the order_id redirect", () => {
    expect(resolveCheckoutOutcome({ orderId: "ord_1" })).toBe("placed");
  });

  it("has nothing to show when the page is opened bare", () => {
    expect(resolveCheckoutOutcome({ orderId: null })).toBe("nothing");
  });

  it("treats an empty-string parameter as absent", () => {
    // `searchParams.get` returns "" for `?order_id=`, which is not an order.
    expect(resolveCheckoutOutcome({ orderId: "" })).toBe("nothing");
  });
});

describe("shouldClearCartOnArrival", () => {
  it("clears for a cash-on-delivery order, which the server already cleared", () => {
    expect(shouldClearCartOnArrival({ orderId: "ord_1" })).toBe(true);
  });

  it("does not clear when the page is opened with no order", () => {
    // The original guard was inverted, so simply opening the page wiped the
    // cart of somebody who had not ordered anything.
    expect(shouldClearCartOnArrival({ orderId: null })).toBe(false);
  });
});
