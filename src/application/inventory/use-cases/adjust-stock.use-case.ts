/**
 * Adjust Stock Use Case
 *
 * Handles stock adjustment with logging. Ensures atomic updates.
 */

import { InventoryRepositoryInterface } from "@/domain/inventory/interfaces/repositories/inventory.repository.interface";
import { inventoryChangeTypeEnum } from "@/db/schema";
import { NotificationService } from "@/application/notifications/notification.service";

type InventoryChangeType = (typeof inventoryChangeTypeEnum.enumValues)[number];

export interface AdjustStockInput {
  variantId: string;
  newQuantity: number;
  reason?: string;
  changeType: InventoryChangeType;
  userId: string;
}

export interface AdjustStockResult {
  success: boolean;
  previousQuantity: number;
  newQuantity: number;
  error?: string;
}

export class AdjustStockUseCase {
  constructor(
    private inventoryRepo: InventoryRepositoryInterface,
    private notifications: NotificationService
  ) {}

  async execute(input: AdjustStockInput): Promise<AdjustStockResult> {
    const { variantId, newQuantity, reason, changeType, userId } = input;

    // Get current stock
    const currentStock = await this.inventoryRepo.getVariantStock(variantId);

    if (currentStock === null) {
      return {
        success: false,
        previousQuantity: 0,
        newQuantity: 0,
        error: "Variant not found",
      };
    }

    // Validate new quantity
    if (newQuantity < 0) {
      return {
        success: false,
        previousQuantity: currentStock,
        newQuantity: currentStock,
        error: "Stock cannot be negative",
      };
    }

    const quantityChange = newQuantity - currentStock;

    // Update stock
    await this.inventoryRepo.updateVariantStock(variantId, newQuantity);

    // Create log entry
    await this.inventoryRepo.createLog({
      variantId,
      changeType,
      quantityChange,
      previousQuantity: currentStock,
      newQuantity,
      reason,
      createdBy: userId,
    });

    // Only when the level crosses the threshold, and only after the write —
    // the service absorbs its own failures, so a notification problem cannot
    // fail the adjustment the admin just made.
    await this.notifications.stockChanged({
      variantId,
      previousQuantity: currentStock,
      newQuantity,
    });

    return {
      success: true,
      previousQuantity: currentStock,
      newQuantity,
    };
  }
}
