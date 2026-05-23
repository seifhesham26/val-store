/**
 * Wishlist Repository Interface
 *
 * Defines the contract for Wishlist data operations.
 */

import { WishlistItemEntity } from "@/domain/wishlist/entities/wishlist-item.entity";

export interface WishlistRepositoryInterface {
  /**
   * Add a product to user's wishlist
   */
  add(userId: string, productId: string): Promise<void>;

  /**
   * Remove a product from user's wishlist
   */
  remove(userId: string, productId: string): Promise<void>;

  /**
   * Get user's wishlist with product details
   */
  findByUserId(userId: string): Promise<WishlistItemEntity[]>;

  /**
   * Check if a product is in user's wishlist
   */
  isInWishlist(userId: string, productId: string): Promise<boolean>;
}
