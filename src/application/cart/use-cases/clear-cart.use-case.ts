/**
 * Clear Cart Use Case
 *
 * Removes all items from the user's cart.
 */

import { CartRepositoryInterface } from "@/domain/interfaces/repositories/cart.repository.interface";

export interface ClearCartOutput {
  success: boolean;
  message: string;
}

export class ClearCartUseCase {
  constructor(private readonly cartRepository: CartRepositoryInterface) {}

  async execute(userId: string): Promise<ClearCartOutput> {
    await this.cartRepository.clearCart(userId);

    return {
      success: true,
      message: "Cart cleared successfully",
    };
  }
}
