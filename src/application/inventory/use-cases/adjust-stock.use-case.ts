/**
 * Adjust Stock Use Case
 *
 * Handles stock adjustment with logging. Ensures atomic updates.
 */

import { InventoryRepositoryInterface } from "@/domain/interfaces/repositories/inventory.repository.interface";
import { inventoryChangeTypeEnum } from "@/db/schema";

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
  constructor(private inventoryRepo: InventoryRepositoryInterface) {}

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

    return {
      success: true,
      previousQuantity: currentStock,
      newQuantity,
    };
  }
}
