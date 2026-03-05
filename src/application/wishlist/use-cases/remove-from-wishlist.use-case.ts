/**
 * Remove From Wishlist Use Case
 */

import { WishlistRepositoryInterface } from "@/domain/interfaces/repositories/wishlist.repository.interface";

export class RemoveFromWishlistUseCase {
  constructor(
    private readonly wishlistRepository: WishlistRepositoryInterface
  ) {}

  async execute(userId: string, productId: string): Promise<void> {
    await this.wishlistRepository.remove(userId, productId);
  }
}
