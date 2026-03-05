/**
 * Add To Wishlist Use Case
 */

import { WishlistRepositoryInterface } from "@/domain/interfaces/repositories/wishlist.repository.interface";

export class AddToWishlistUseCase {
  constructor(
    private readonly wishlistRepository: WishlistRepositoryInterface
  ) {}

  async execute(userId: string, productId: string): Promise<void> {
    await this.wishlistRepository.add(userId, productId);
  }
}
