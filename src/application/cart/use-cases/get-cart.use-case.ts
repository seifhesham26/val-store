/**
 * Get Cart Use Case
 *
 * Retrieves all cart items for a user with totals.
 */

import { CartRepositoryInterface } from "@/domain/interfaces/repositories/cart.repository.interface";

export interface CartItemDto {
  id: string;
  productId: string;
  productName: string;
  productPrice: number;
  productImage: string | null;
  quantity: number;
  maxStock: number;
  subtotal: number;
  canIncrease: boolean;
  canDecrease: boolean;
}

export interface GetCartOutput {
  items: CartItemDto[];
  subtotal: number;
  itemCount: number;
  isEmpty: boolean;
}

export class GetCartUseCase {
  constructor(private readonly cartRepository: CartRepositoryInterface) {}

  async execute(userId: string): Promise<GetCartOutput> {
    const cartItems = await this.cartRepository.findByUserId(userId);

    const items: CartItemDto[] = cartItems.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      productPrice: item.productPrice,
      productImage: item.productImage,
      quantity: item.quantity,
      maxStock: item.maxStock,
      subtotal: item.calculateSubtotal(),
      canIncrease: item.canIncrease(),
      canDecrease: item.canDecrease(),
    }));

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items,
      subtotal,
      itemCount,
      isEmpty: items.length === 0,
    };
  }
}
