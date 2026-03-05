/**
 * Update Cart Item Use Case
 *
 * Updates the quantity of a cart item.
 */

import { CartRepositoryInterface } from "@/domain/interfaces/repositories/cart.repository.interface";

export interface UpdateCartItemInput {
  cartItemId: string;
  quantity: number;
  userId: string; // For verification
}

export interface UpdateCartItemOutput {
  cartItem: {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    subtotal: number;
  };
  cartTotal: number;
  cartItemCount: number;
}

export class UpdateCartItemUseCase {
  constructor(private readonly cartRepository: CartRepositoryInterface) {}

  async execute(input: UpdateCartItemInput): Promise<UpdateCartItemOutput> {
    const { cartItemId, quantity, userId } = input;

    if (quantity < 1) {
      throw new Error("Quantity must be at least 1");
    }

    // Verify the item belongs to the user
    const existingItem = await this.cartRepository.findById(cartItemId);
    if (!existingItem) {
      throw new Error("Cart item not found");
    }
    if (existingItem.userId !== userId) {
      throw new Error("Unauthorized: Cart item does not belong to user");
    }

    // Check stock constraint
    if (quantity > existingItem.maxStock && existingItem.maxStock > 0) {
      throw new Error(
        `Cannot set quantity to ${quantity}. Maximum available stock is ${existingItem.maxStock}`
      );
    }

    const updatedItem = await this.cartRepository.updateQuantity(
      cartItemId,
      quantity
    );

    // Get updated totals
    const [cartTotal, cartItemCount] = await Promise.all([
      this.cartRepository.getCartTotal(userId),
      this.cartRepository.getCartItemCount(userId),
    ]);

    return {
      cartItem: {
        id: updatedItem.id,
        productId: updatedItem.productId,
        productName: updatedItem.productName,
        quantity: updatedItem.quantity,
        price: updatedItem.productPrice,
        subtotal: updatedItem.calculateSubtotal(),
      },
      cartTotal,
      cartItemCount,
    };
  }
}
