import { describe, it, expect, vi } from "vitest";
import { AdjustStockUseCase } from "./adjust-stock.use-case";
import type { InventoryRepositoryInterface } from "@/domain/inventory/interfaces/repositories/inventory.repository.interface";
import type { NotificationService } from "@/application/notifications/notification.service";

describe("AdjustStockUseCase", () => {
  it.each([
    {
      stored: null,
      expected: {
        success: false,
        previousQuantity: 0,
        newQuantity: 0,
        error: "Variant not found",
      },
    },
    {
      stored: {
        previousQuantity: 7,
        newQuantity: 7,
        sellabilityChanged: false,
        error: "Stock cannot be negative" as const,
      },
      expected: {
        success: false,
        previousQuantity: 7,
        newQuantity: 7,
        error: "Stock cannot be negative",
      },
    },
  ])(
    "returns locked validation result $expected.error without notifying",
    async ({ stored, expected }) => {
      const inventory = {
        adjustStockWithLog: vi.fn(async () => stored),
      } as unknown as InventoryRepositoryInterface;
      const notifications = {
        stockChanged: vi.fn(),
      } as unknown as NotificationService;
      expect(
        await new AdjustStockUseCase(inventory, notifications).execute({
          variantId: "v1",
          newQuantity: -1,
          changeType: "adjustment",
          userId: "admin-1",
        })
      ).toEqual(expected);
      expect(notifications.stockChanged).not.toHaveBeenCalled();
    }
  );

  it("returns and notifies using the atomic result without an unlocked read", async () => {
    const inventory = {
      adjustStockWithLog: vi.fn(async () => ({
        previousQuantity: 7,
        newQuantity: 12,
        sellabilityChanged: true,
      })),
    } as unknown as InventoryRepositoryInterface;
    const notifications = {
      stockChanged: vi.fn(),
    } as unknown as NotificationService;
    expect(
      await new AdjustStockUseCase(inventory, notifications).execute({
        variantId: "v1",
        newQuantity: 12,
        changeType: "restock",
        reason: "Supplier delivery",
        userId: "admin-1",
      })
    ).toEqual({ success: true, previousQuantity: 7, newQuantity: 12 });
    expect(inventory.adjustStockWithLog).toHaveBeenCalledExactlyOnceWith(
      "v1",
      12,
      {
        changeType: "restock",
        reason: "Supplier delivery",
        createdBy: "admin-1",
      }
    );
    expect(notifications.stockChanged).toHaveBeenCalledExactlyOnceWith({
      variantId: "v1",
      previousQuantity: 7,
      newQuantity: 12,
    });
  });
});
