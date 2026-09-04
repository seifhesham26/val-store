/**
 * Update Cart Item Use Case
 *
 * Updates the quantity of a cart item.
 */

import { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";

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

    // Check stock constraint. `maxStock` is a real, always-populated figure
    // — the chosen variant's stock, or the summed stock of a variant-less
    // product's rows (`DrizzleCartRepository.mapToEntity`), never "unknown."
    // So `maxStock === 0` genuinely means nothing is available, not that the
    // ceiling doesn't apply — an earlier `&& existingItem.maxStock > 0`
    // disabled the check in exactly that case, letting an out-of-stock line
    // accept any quantity.
    //
    // The ceiling bounds *increases*, not the line's continued existence. A
    // customer holding 3 of an item whose stock has since fallen to 1 (or to
    // 0) is already over the ceiling through no action of their own; refusing
    // 3 -> 1 as well leaves removing the line as their only move, and pushes
    // them further from a cart that can check out rather than closer to one.
    // A reduction is therefore always allowed. Nothing is oversold by it:
    // `order.repository.create` re-checks every line under `FOR UPDATE`.
    const isReduction = quantity < existingItem.quantity;

    if (quantity > existingItem.maxStock && !isReduction) {
      throw new Error(
        existingItem.maxStock === 0
          ? "This item is out of stock"
          : `Cannot set quantity to ${quantity}. Maximum available stock is ${existingItem.maxStock}`
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
