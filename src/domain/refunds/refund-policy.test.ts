import { describe, expect, it } from "vitest";

import { calculateRefund } from "./refund-policy";

describe("calculateRefund", () => {
  it.each([
    ["change_of_mind", "unworn", 1000, 1000],
    ["change_of_mind", "worn_resellable", 1000, 700],
    ["defective", "defective", 1000, 1000],
  ] as const)(
    "calculates the approved item amount for %s/%s",
    (reason, outcome, paidAmount, expected) => {
      expect(
        calculateRefund({
          reason,
          items: [{ paidAmount, outcome }],
          originalDelivery: 80,
          returnedAllOrder: true,
          collectionFee: 60,
          capturedPayment: 1080,
        }).itemRefund
      ).toBe(expected);
    }
  );

  it("refunds original delivery only for a full merchant-fault return", () => {
    expect(
      calculateRefund({
        reason: "defective",
        items: [{ paidAmount: 450, outcome: "defective" }],
        originalDelivery: 80,
        returnedAllOrder: true,
        collectionFee: 60,
        capturedPayment: 530,
      }).deliveryRefund
    ).toBe(80);
  });

  it("rejects customer-caused damage and charges collection", () => {
    expect(
      calculateRefund({
        reason: "change_of_mind",
        items: [{ paidAmount: 1000, outcome: "customer_damage" }],
        originalDelivery: 80,
        returnedAllOrder: false,
        collectionFee: 60,
        capturedPayment: 1080,
      })
    ).toMatchObject({
      disposition: "rejected",
      totalRefund: 0,
      customerCollectionDue: 60,
    });
  });

  it("handles zero delivery and multiple approved lines", () => {
    expect(
      calculateRefund({
        reason: "change_of_mind",
        items: [
          { paidAmount: 400, outcome: "unworn" },
          { paidAmount: 250, outcome: "worn_resellable" },
        ],
        originalDelivery: 0,
        returnedAllOrder: true,
        collectionFee: 60,
        capturedPayment: 650,
      })
    ).toMatchObject({
      itemRefund: 575,
      deliveryRefund: 0,
      totalRefund: 575,
      disposition: "resellable",
    });
  });

  it("rounds a goodwill refund to two decimal places", () => {
    expect(
      calculateRefund({
        reason: "change_of_mind",
        items: [{ paidAmount: 1000.01, outcome: "worn_resellable" }],
        originalDelivery: 0,
        returnedAllOrder: false,
        collectionFee: 0,
        capturedPayment: 1000.01,
      }).itemRefund
    ).toBe(700.01);
  });

  it("caps the combined refund at captured payment", () => {
    expect(
      calculateRefund({
        reason: "defective",
        items: [{ paidAmount: 1000, outcome: "defective" }],
        originalDelivery: 80,
        returnedAllOrder: true,
        collectionFee: 0,
        capturedPayment: 1050,
      })
    ).toMatchObject({
      itemRefund: 1000,
      deliveryRefund: 50,
      totalRefund: 1050,
    });
  });

  it("does not refund delivery when a full request has a customer-caused line", () => {
    expect(
      calculateRefund({
        reason: "defective",
        items: [
          { paidAmount: 500, outcome: "defective" },
          { paidAmount: 300, outcome: "customer_damage" },
        ],
        originalDelivery: 80,
        returnedAllOrder: true,
        collectionFee: 60,
        capturedPayment: 880,
      })
    ).toMatchObject({
      itemRefund: 500,
      deliveryRefund: 0,
      totalRefund: 500,
      customerCollectionDue: 60,
      disposition: "mixed",
    });
  });
});
