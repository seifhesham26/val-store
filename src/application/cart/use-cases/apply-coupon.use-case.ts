/**
 * Apply Coupon Use Case
 *
 * Records which coupon a cart is holding. It does not reserve anything: the
 * code stays available to everyone until an order actually redeems it, and the
 * guarded update in the order repository remains the only thing that decides
 * whether a redemption is allowed.
 *
 * No discount is computed or stored here. The cart remembers the code; the
 * money is worked out once, at checkout, so the two can never disagree.
 */

import { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import { ValidateCouponUseCase } from "@/application/coupons/use-cases/validate-coupon.use-case";

export interface ApplyCouponInput {
  userId: string;
  code: string;
}

export interface ApplyCouponResult {
  applied: boolean;
  code?: string;
  error?: string;
}

export class ApplyCouponUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryInterface,
    private readonly validateCoupon: ValidateCouponUseCase
  ) {}

  async execute(input: ApplyCouponInput): Promise<ApplyCouponResult> {
    const code = input.code.trim().toUpperCase();

    // Minimum-purchase rules are meaningless against an empty cart, and the
    // validator would reject with a confusing message about the minimum
    // rather than the real problem.
    const subtotal = await this.cartRepository.getCartTotal(input.userId);
    if (subtotal <= 0) {
      return {
        applied: false,
        error: "Add something to your cart first, then apply your code.",
      };
    }

    const result = await this.validateCoupon.execute(
      code,
      subtotal,
      input.userId
    );

    if (!result.valid || !result.coupon) {
      return {
        applied: false,
        error: result.error ?? "That code cannot be used right now.",
      };
    }

    // Replaces whatever was applied before — one coupon per cart.
    await this.cartRepository.setAppliedCoupon(input.userId, result.coupon.id);

    return { applied: true, code: result.coupon.code };
  }
}
