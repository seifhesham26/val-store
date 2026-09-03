import { describe, it, expect } from "vitest";
import {
  resolveCheckoutOutcome,
  shouldClearCartOnArrival,
  type CheckoutOutcomeInput,
} from "./checkout-outcome";

const base: CheckoutOutcomeInput = {
  sessionId: null,
  orderId: null,
  confirmFailed: false,
  confirmResult: undefined,
};

const outcome = (over: Partial<CheckoutOutcomeInput>) =>
  resolveCheckoutOutcome({ ...base, ...over });

describe("resolveCheckoutOutcome", () => {
  describe("card checkout", () => {
    it("waits while the confirmation is still in flight", () => {
      // The bug: this rendered "Thank you for your order!" before the server
      // had said anything at all.
      expect(outcome({ sessionId: "cs_1" })).toBe("confirming");
    });

    it("is placed once the server confirms payment", () => {
      expect(
        outcome({ sessionId: "cs_1", confirmResult: { paid: true } })
      ).toBe("placed");
    });

    it("is unpaid when Stripe reports the session unpaid", () => {
      // `confirmSession` returns { paid: false } as an ordinary result, not an
      // error. Nothing rendered it, so an unpaid checkout said thank you.
      expect(
        outcome({ sessionId: "cs_1", confirmResult: { paid: false } })
      ).toBe("unpaid");
    });

    it("is unconfirmed when the confirmation call itself fails", () => {
      // The mutation had no onError, so this also said thank you.
      expect(outcome({ sessionId: "cs_1", confirmFailed: true })).toBe(
        "unconfirmed"
      );
    });

    it("reports the failure even if a result arrived first", () => {
      expect(
        outcome({
          sessionId: "cs_1",
          confirmFailed: true,
          confirmResult: { paid: true },
        })
      ).toBe("unconfirmed");
    });
  });

  describe("cash on delivery", () => {
    it("is placed on the order_id redirect", () => {
      expect(outcome({ orderId: "ord_1" })).toBe("placed");
    });

    it("does not need a confirmation result", () => {
      // The order was committed server-side before the redirect.
      expect(outcome({ orderId: "ord_1", confirmResult: undefined })).toBe(
        "placed"
      );
    });
  });

  describe("both parameters present", () => {
    it("lets the card path decide, and does not claim success early", () => {
      // A stray order_id must not short-circuit the confirmation a card return
      // requires. This is the shape of the original bug.
      expect(outcome({ sessionId: "cs_1", orderId: "ord_1" })).toBe(
        "confirming"
      );
    });

    it("still reports an unpaid session as unpaid", () => {
      expect(
        outcome({
          sessionId: "cs_1",
          orderId: "ord_1",
          confirmResult: { paid: false },
        })
      ).toBe("unpaid");
    });
  });

  it("has nothing to show when the page is opened bare", () => {
    expect(outcome({})).toBe("nothing");
  });

  it("treats empty-string parameters as absent", () => {
    // `searchParams.get` returns "" for `?session_id=`, which is not an order.
    expect(outcome({ sessionId: "", orderId: "" })).toBe("nothing");
  });
});

describe("shouldClearCartOnArrival", () => {
  it("clears for a cash-on-delivery order, which the server already cleared", () => {
    expect(
      shouldClearCartOnArrival({ sessionId: null, orderId: "ord_1" })
    ).toBe(true);
  });

  it("does not clear on a card return — that waits for confirmed payment", () => {
    // An abandoned checkout must keep the customer's cart.
    expect(shouldClearCartOnArrival({ sessionId: "cs_1", orderId: null })).toBe(
      false
    );
  });

  it("does not clear when the page is opened with no order", () => {
    // The original guard was `!sessionId`, so simply opening the page wiped the
    // cart of somebody who had not ordered anything.
    expect(shouldClearCartOnArrival({ sessionId: null, orderId: null })).toBe(
      false
    );
  });
});
