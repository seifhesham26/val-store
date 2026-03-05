import { ProductRepositoryInterface } from "@/domain/interfaces/repositories/product.repository.interface";
import { ProductNotFoundException } from "@/domain/exceptions/product-not-found.exception";

/**
 * Toggle Product Status Use Case
 *
 * Toggles a product's active status (active <-> inactive).
 */

export interface ToggleProductStatusInput {
  id: string;
}

export interface ToggleProductStatusOutput {
  id: string;
  name: string;
  isActive: boolean;
  message: string;
}

export class ToggleProductStatusUseCase {
  constructor(private readonly productRepository: ProductRepositoryInterface) {}

  async execute(
    input: ToggleProductStatusInput
  ): Promise<ToggleProductStatusOutput> {
    // 1. Check if product exists
    const product = await this.productRepository.findById(input.id);
    if (!product) {
      throw new ProductNotFoundException(input.id);
    }

    // 2. Toggle status
    const updated = await this.productRepository.toggleStatus(input.id);

    return {
      id: updated.id,
      name: updated.name,
      isActive: updated.isActive,
      message: `Product ${updated.isActive ? "activated" : "deactivated"} successfully`,
    };
  }
}
