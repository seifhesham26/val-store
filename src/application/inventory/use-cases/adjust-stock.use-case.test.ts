import { describe, it, expect, vi } from "vitest";
import { AdjustStockUseCase } from "./adjust-stock.use-case";
import type { InventoryRepositoryInterface } from "@/domain/inventory/interfaces/repositories/inventory.repository.interface";
import type { NotificationService } from "@/application/notifications/notification.service";

function repo(
  over: Partial<InventoryRepositoryInterface> = {}
): InventoryRepositoryInterface {
  return {
    createLog: vi.fn(),
    getLogsByVariant: vi.fn(),
    getLogsByProduct: vi.fn(),
    getAllLogs: vi.fn(),
    getLowStockVariants: vi.fn(),
    getAllVariantsWithStock: vi.fn(),
    updateVariantStock: vi.fn(),
    getVariantStock: vi.fn(async () => 10),
    adjustStockWithLog: vi.fn(async (_id, newQuantity) => ({
      previousQuantity: 10,
      newQuantity,
    })),
    getVariantsStock: vi.fn(async () => []),
    ...over,
  } as unknown as InventoryRepositoryInterface;
}

function notifications(): NotificationService {
  return { stockChanged: vi.fn() } as unknown as NotificationService;
}

describe("AdjustStockUseCase", () => {
  it("returns not-found without writing when the variant does not exist", async () => {
    const inventoryRepo = repo({ getVariantStock: vi.fn(async () => null) });
    const notificationService = notifications();

    const result = await new AdjustStockUseCase(
      inventoryRepo,
      notificationService
    ).execute({
      variantId: "missing",
      newQuantity: 5,
      changeType: "adjustment",
      userId: "admin-1",
    });

    expect(result).toEqual({
      success: false,
      previousQuantity: 0,
      newQuantity: 0,
      error: "Variant not found",
    });
    expect(inventoryRepo.adjustStockWithLog).not.toHaveBeenCalled();
  });

  it("rejects a negative target without writing", async () => {
    const inventoryRepo = repo({ getVariantStock: vi.fn(async () => 10) });
    const notificationService = notifications();

    const result = await new AdjustStockUseCase(
      inventoryRepo,
      notificationService
    ).execute({
      variantId: "v1",
      newQuantity: -1,
      changeType: "adjustment",
      userId: "admin-1",
    });

    expect(result).toEqual({
      success: false,
      previousQuantity: 10,
      newQuantity: 10,
      error: "Stock cannot be negative",
    });
    expect(inventoryRepo.adjustStockWithLog).not.toHaveBeenCalled();
  });

  it("delegates the write to the atomic repository method and trusts its result over the preliminary read", async () => {
    // The preliminary getVariantStock read says 10, but a concurrent
    // checkout decremented the row before the locked write ran — exactly
    // the race this fix closes. adjustStockWithLog reports the truthful,
    // locked previousQuantity (7), and the use case must return that, not
    // the stale 10 from the earlier unlocked read.
    const inventoryRepo = repo({
      getVariantStock: vi.fn(async () => 10),
      adjustStockWithLog: vi.fn(async () => ({
        previousQuantity: 7,
        newQuantity: 12,
      })),
    });
    const notificationService = notifications();

    const result = await new AdjustStockUseCase(
      inventoryRepo,
      notificationService
    ).execute({
      variantId: "v1",
      newQuantity: 12,
      changeType: "restock",
      reason: "Supplier delivery",
      userId: "admin-1",
    });

    expect(result).toEqual({
      success: true,
      previousQuantity: 7,
      newQuantity: 12,
    });
    expect(inventoryRepo.adjustStockWithLog).toHaveBeenCalledWith("v1", 12, {
      changeType: "restock",
      reason: "Supplier delivery",
      createdBy: "admin-1",
    });
    // Stock write, lock, and audit log all happen inside that one
    // repository call — the use case itself must never call the old
    // separate updateVariantStock/createLog primitives.
    expect(inventoryRepo.updateVariantStock).not.toHaveBeenCalled();
    expect(inventoryRepo.createLog).not.toHaveBeenCalled();
    expect(notificationService.stockChanged).toHaveBeenCalledWith({
      variantId: "v1",
      previousQuantity: 7,
      newQuantity: 12,
    });
  });

  it("reports not-found when the variant is deleted between the preliminary read and the locked write", async () => {
    const inventoryRepo = repo({
      getVariantStock: vi.fn(async () => 10),
      adjustStockWithLog: vi.fn(async () => null),
    });
    const notificationService = notifications();

    const result = await new AdjustStockUseCase(
      inventoryRepo,
      notificationService
    ).execute({
      variantId: "v1",
      newQuantity: 12,
      changeType: "adjustment",
      userId: "admin-1",
    });

    expect(result).toEqual({
      success: false,
      previousQuantity: 10,
      newQuantity: 10,
      error: "Variant not found",
    });
    expect(notificationService.stockChanged).not.toHaveBeenCalled();
  });
});
