import { ProductRepositoryInterface } from "@/domain/interfaces/repositories/product.repository.interface";
import { ProductNotFoundException } from "@/domain/exceptions/product-not-found.exception";

/**
 * Delete Product Use Case
 *
 * Handles soft deletion of products (sets isActive = false).
 */

export interface DeleteProductInput {
  id: string;
}

export interface DeleteProductOutput {
  success: boolean;
  message: string;
}

export class DeleteProductUseCase {
  constructor(private readonly productRepository: ProductRepositoryInterface) {}

  async execute(input: DeleteProductInput): Promise<DeleteProductOutput> {
    // 1. Check if product exists
    const product = await this.productRepository.findById(input.id);
    if (!product) {
      throw new ProductNotFoundException(input.id);
    }

    // 2. Soft delete (set isActive = false)
    await this.productRepository.delete(input.id);

    return {
      success: true,
      message: `Product "${product.name}" deleted successfully`,
    };
  }
}
