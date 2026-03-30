/**
 * Check Wishlist Status Use Case
 */

import { WishlistRepositoryInterface } from "@/domain/wishlist/interfaces/repositories/wishlist.repository.interface";

export class CheckWishlistStatusUseCase {
  constructor(
    private readonly wishlistRepository: WishlistRepositoryInterface
  ) {}

  async execute(userId: string, productId: string): Promise<boolean> {
    return this.wishlistRepository.isInWishlist(userId, productId);
  }
}
