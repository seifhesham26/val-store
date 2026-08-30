/**
 * Change Cart Item Variant Use Case
 *
 * Swaps a cart line onto a different variant of the same product — the action
 * behind "White / M is sold out, take Black / M instead".
 *
 * Done server-side rather than as a remove-then-add from the client so the
 * ownership and product checks happen in one place and a dropped connection
 * cannot leave the customer with a half-applied change.
 */

import { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import { ProductVariantRepositoryInterface } from "@/domain/products/interfaces/repositories/product-variant.repository.interface";
import { CartItemEntity } from "@/domain/cart/entities/cart-item.entity";

export interface ChangeCartItemVariantInput {
  userId: string;
  cartItemId: string;
  variantId: string;
}

export interface ChangeCartItemVariantOutput {
  /** Quantity the line ended up with. */
  quantity: number;
  /** True when the new variant had less stock than the line asked for. */
  reduced: boolean;
}

export class ChangeCartItemVariantUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryInterface,
    private readonly variantRepository: ProductVariantRepositoryInterface
  ) {}

  async execute(
    input: ChangeCartItemVariantInput
  ): Promise<ChangeCartItemVariantOutput> {
    const { userId, cartItemId, variantId } = input;

    const item = await this.cartRepository.findById(cartItemId);
    if (!item || item.userId !== userId) {
      throw new Error("Cart item not found");
    }

    if (item.variantId === variantId) {
      return { quantity: item.quantity, reduced: false };
    }

    const variant = await this.variantRepository.findById(variantId);
    if (!variant || variant.productId !== item.productId) {
      throw new Error("That option is not available for this product");
    }

    if (!variant.isInStock()) {
      throw new Error("That option is out of stock");
    }

    // The replacement may itself hold fewer units than the original line.
    const quantity = Math.min(item.quantity, variant.stockQuantity);

    // Add first, remove second. If the add is rejected the customer still has
    // their original line; the reverse order would lose it on any failure.
    await this.cartRepository.addItem(
      new CartItemEntity(
        "",
        userId,
        item.productId,
        item.productName,
        item.productPrice,
        item.productImage,
        quantity,
        variant.stockQuantity,
        new Date(),
        new Date(),
        variantId,
        variant.size,
        variant.color
      )
    );

    await this.cartRepository.removeItem(cartItemId);

    return { quantity, reduced: quantity < item.quantity };
  }
}
