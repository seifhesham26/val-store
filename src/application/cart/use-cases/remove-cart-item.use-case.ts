/**
 * Remove Cart Item Use Case
 *
 * Removes an item from the user's cart.
 */

import { CartRepositoryInterface } from "@/domain/interfaces/repositories/cart.repository.interface";

export interface RemoveCartItemInput {
  cartItemId: string;
  userId: string; // For verification
}

export interface RemoveCartItemOutput {
  success: boolean;
  cartTotal: number;
  cartItemCount: number;
}

export class RemoveCartItemUseCase {
  constructor(private readonly cartRepository: CartRepositoryInterface) {}

  async execute(input: RemoveCartItemInput): Promise<RemoveCartItemOutput> {
    const { cartItemId, userId } = input;

    // Verify the item belongs to the user
    const existingItem = await this.cartRepository.findById(cartItemId);
    if (!existingItem) {
      throw new Error("Cart item not found");
    }
    if (existingItem.userId !== userId) {
      throw new Error("Unauthorized: Cart item does not belong to user");
    }

    await this.cartRepository.removeItem(cartItemId);

    // Get updated totals
    const [cartTotal, cartItemCount] = await Promise.all([
      this.cartRepository.getCartTotal(userId),
      this.cartRepository.getCartItemCount(userId),
    ]);

    return {
      success: true,
      cartTotal,
      cartItemCount,
    };
  }
}
