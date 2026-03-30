/**
 * Cart Repository Interface
 *
 * Defines the contract for shopping cart data operations.
 * Implementation will be in the infrastructure layer.
 */

import { CartItemEntity } from "@/domain/cart/entities/cart-item.entity";

export interface CartRepositoryInterface {
  /**
   * Find a cart item by ID
   */
  findById(cartItemId: string): Promise<CartItemEntity | null>;

  /**
   * Find all cart items for a user
   */
  findByUserId(userId: string): Promise<CartItemEntity[]>;

  /**
   * Find a specific cart item for a user and product
   */
  findByUserAndProduct(
    userId: string,
    productId: string
  ): Promise<CartItemEntity | null>;

  /**
   * Add item to cart (or update quantity if exists)
   */
  addItem(cartItem: CartItemEntity): Promise<CartItemEntity>;

  /**
   * Update cart item quantity to an absolute value
   * @param cartItemId - Cart item ID
   * @param newQuantity - New quantity (absolute value, must be > 0)
   */
  updateQuantity(
    cartItemId: string,
    newQuantity: number
  ): Promise<CartItemEntity>;

  /**
   * Remove item from cart
   */
  removeItem(cartItemId: string): Promise<void>;

  /**
   * Clear all cart items for a user
   */
  clearCart(userId: string): Promise<void>;

  /**
   * Get cart total for a user
   */
  getCartTotal(userId: string): Promise<number>;

  /**
   * Get cart item count for a user
   */
  getCartItemCount(userId: string): Promise<number>;

  /**
   * Check if product is in user's cart
   */
  isProductInCart(userId: string, productId: string): Promise<boolean>;
}
