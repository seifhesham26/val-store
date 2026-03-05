/**
 * Update Variant Stock Use Case
 *
 * Updates stock quantity for a product variant.
 * Supports both absolute updates and delta adjustments.
 */

import { ProductVariantRepositoryInterface } from "@/domain/interfaces/repositories/product-variant.repository.interface";

export interface UpdateVariantStockInput {
  variantId: string;
  /** New absolute quantity (if mode is 'set') */
  quantity?: number;
  /** Delta to add/subtract (if mode is 'adjust') */
  delta?: number;
  /** 'set' for absolute, 'adjust' for delta */
  mode: "set" | "adjust";
}

export interface UpdateVariantStockOutput {
  id: string;
  sku: string;
  previousStock: number;
  newStock: number;
  isInStock: boolean;
}

export class UpdateVariantStockUseCase {
  constructor(
    private readonly variantRepository: ProductVariantRepositoryInterface
  ) {}

  async execute(
    input: UpdateVariantStockInput
  ): Promise<UpdateVariantStockOutput> {
    // Find existing variant
    const existing = await this.variantRepository.findById(input.variantId);
    if (!existing) {
      throw new Error(`Variant with ID "${input.variantId}" not found`);
    }

    const previousStock = existing.stockQuantity;
    let updated;

    if (input.mode === "set") {
      if (input.quantity === undefined || input.quantity < 0) {
        throw new Error(
          "Quantity must be a non-negative number for 'set' mode"
        );
      }
      updated = await this.variantRepository.updateStock(
        input.variantId,
        input.quantity
      );
    } else if (input.mode === "adjust") {
      if (input.delta === undefined) {
        throw new Error("Delta must be provided for 'adjust' mode");
      }
      updated = await this.variantRepository.adjustStock(
        input.variantId,
        input.delta
      );
    } else {
      throw new Error("Invalid mode. Use 'set' or 'adjust'");
    }

    return {
      id: updated.id,
      sku: updated.sku,
      previousStock,
      newStock: updated.stockQuantity,
      isInStock: updated.isInStock(),
    };
  }
}
