/**
 * Remove Coupon Use Case
 *
 * Always succeeds, including when no coupon is applied — the customer's intent
 * ("I do not want this code") is satisfied either way, and reporting an error
 * for a cart that is already in the requested state is noise.
 */

import { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";

export class RemoveCouponUseCase {
  constructor(private readonly cartRepository: CartRepositoryInterface) {}

  async execute(userId: string): Promise<void> {
    await this.cartRepository.clearAppliedCoupon(userId);
  }
}
