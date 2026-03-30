/**
 * Get Wishlist Use Case
 */

import { WishlistRepositoryInterface } from "@/domain/wishlist/interfaces/repositories/wishlist.repository.interface";

export class GetWishlistUseCase {
  constructor(
    private readonly wishlistRepository: WishlistRepositoryInterface
  ) {}

  async execute(userId: string) {
    return this.wishlistRepository.findByUserId(userId);
  }
}
