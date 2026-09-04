/**
 * Adjust Stock Use Case
 *
 * Handles stock adjustment with logging. The write is an absolute "set
 * stock to N" (the admin screen sets a target, not a delta), and the
 * atomicity guarantee is delegated to the repository:
 * `adjustStockWithLog` locks the variant row, reads the current level from
 * that locked read, writes the new level, and inserts the audit log row —
 * all inside one transaction. That is what makes both halves of "atomic"
 * true: the stock write can no longer land between a concurrent checkout's
 * locked read and write and silently erase its decrement, and the stock
 * write and the audit-log insert can no longer diverge if one fails and the
 * other does not.
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

    // Unlocked read, used only to shape the two validation errors below —
    // nothing is written from it. The previousQuantity that actually gets
    // logged comes from the locked read inside adjustStockWithLog, so a
    // concurrent write landing between this check and that call cannot be
    // silently overwritten by a stale value from here.
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

    // Row lock, stock write, and audit log insert happen together in one
    // transaction — see the class docblock.
    const result = await this.inventoryRepo.adjustStockWithLog(
      variantId,
      newQuantity,
      { changeType, reason, createdBy: userId }
    );

    if (!result) {
      // The variant existed moments ago (the read above found it) but was
      // gone by the time the locked write ran — deleted concurrently. Report
      // it the same way as the initial not-found case.
      return {
        success: false,
        previousQuantity: currentStock,
        newQuantity: currentStock,
        error: "Variant not found",
      };
    }

    // Only when the level crosses the threshold, and only after the write —
    // the service absorbs its own failures, so a notification problem cannot
    // fail the adjustment the admin just made.
    await this.notifications.stockChanged({
      variantId,
      previousQuantity: result.previousQuantity,
      newQuantity: result.newQuantity,
    });

    return {
      success: true,
      previousQuantity: result.previousQuantity,
      newQuantity: result.newQuantity,
    };
  }
}
