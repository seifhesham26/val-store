import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  CreateAdjustmentRequestCommand,
  InventoryActorSnapshot,
} from "./inventory-operations";
import {
  resolveInventoryAvailability,
  shouldCloseInspectionCycle,
  shouldOpenInspection,
} from "./inventory-policy";

describe("resolveInventoryAvailability", () => {
  it.each([
    [20, 10],
    [19, 9],
    [11, 1],
    [10, 0],
    [1, 0],
    [0, 0],
  ])("protects the floor at %i recorded units", (stockQuantity, expected) => {
    expect(
      resolveInventoryAvailability({
        stockQuantity,
        isAvailable: true,
        hasPendingInspection: stockQuantity > 0,
        hasPendingFlaw: false,
      }).sellableStock
    ).toBe(expected);
  });

  it("quarantines a flaw and preserves manual unavailability", () => {
    expect(
      resolveInventoryAvailability({
        stockQuantity: 30,
        isAvailable: true,
        hasPendingInspection: false,
        hasPendingFlaw: true,
      })
    ).toMatchObject({ sellableStock: 0, state: "quarantined" });
    expect(
      resolveInventoryAvailability({
        stockQuantity: 30,
        isAvailable: false,
        hasPendingInspection: false,
        hasPendingFlaw: false,
      })
    ).toMatchObject({ sellableStock: 0, state: "manually_unavailable" });
  });
});

describe("inspection cycles", () => {
  it.each([
    [21, 20],
    [0, 15],
  ])("opens on entry from %i to %i", (previousStock, stockQuantity) => {
    expect(
      shouldOpenInspection({
        previousStock,
        stockQuantity,
        hasOpenCycle: false,
      })
    ).toBe(true);
  });

  it.each([0, 21])(
    "closes outside the low-stock range at %i",
    (stockQuantity) => {
      expect(shouldCloseInspectionCycle(stockQuantity)).toBe(true);
    }
  );
});

describe("inventory actor records", () => {
  it("retains a deleted actor's name in history while commands require an id", () => {
    const historicalActor: InventoryActorSnapshot = {
      id: null,
      name: "Former worker",
    };

    expect(historicalActor).toEqual({ id: null, name: "Former worker" });
    expectTypeOf<
      CreateAdjustmentRequestCommand["requester"]["id"]
    >().toEqualTypeOf<string>();
  });
});
