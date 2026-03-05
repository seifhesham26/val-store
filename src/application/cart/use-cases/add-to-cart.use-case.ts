/**
 * Add to Cart Use Case
 *
 * Adds a product to the user's cart.
 * If the product already exists, increases the quantity.
 */

import { CartRepositoryInterface } from "@/domain/interfaces/repositories/cart.repository.interface";
import { CartItemEntity } from "@/domain/entities/cart-item.entity";

export interface AddToCartInput {
  userId: string;
  productId: string;
  quantity: number;
}

export interface AddToCartOutput {
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

export class AddToCartUseCase {
  constructor(private readonly cartRepository: CartRepositoryInterface) {}

  async execute(input: AddToCartInput): Promise<AddToCartOutput> {
    const { userId, productId, quantity } = input;

    if (quantity < 1) {
      throw new Error("Quantity must be at least 1");
    }

    // Create a temporary entity for adding (repo will handle merge)
    const cartItem = new CartItemEntity(
      "", // ID will be assigned by repo
      userId,
      productId,
      "", // Product name loaded by repo
      0, // Price loaded by repo
      null, // Image loaded by repo
      quantity,
      0, // Max stock loaded by repo
      new Date(),
      new Date()
    );

    const addedItem = await this.cartRepository.addItem(cartItem);

    // Get updated totals
    const [cartTotal, cartItemCount] = await Promise.all([
      this.cartRepository.getCartTotal(userId),
      this.cartRepository.getCartItemCount(userId),
    ]);

    return {
      cartItem: {
        id: addedItem.id,
        productId: addedItem.productId,
        productName: addedItem.productName,
        quantity: addedItem.quantity,
        price: addedItem.productPrice,
        subtotal: addedItem.calculateSubtotal(),
      },
      cartTotal,
      cartItemCount,
    };
  }
}
