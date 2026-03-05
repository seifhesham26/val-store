/**
 * Validate Coupon Use Case
 *
 * Validates a coupon code and calculates the discount amount.
 */

import { CouponRepositoryInterface } from "@/domain/interfaces/repositories/coupon.repository.interface";
import { Coupon } from "@/db/schema";

export interface ValidateCouponResult {
  valid: boolean;
  coupon?: Coupon;
  discountAmount?: number;
  error?: string;
}

export class ValidateCouponUseCase {
  constructor(private couponRepo: CouponRepositoryInterface) {}

  async execute(
    code: string,
    subtotal: number,
    userId?: string
  ): Promise<ValidateCouponResult> {
    // Find coupon by code
    const coupon = await this.couponRepo.findByCode(code);

    if (!coupon) {
      return { valid: false, error: "Invalid coupon code" };
    }

    // Check if active
    if (!coupon.isActive) {
      return { valid: false, error: "This coupon is no longer active" };
    }

    // Check start date
    if (coupon.startsAt && new Date(coupon.startsAt) > new Date()) {
      return { valid: false, error: "This coupon is not yet valid" };
    }

    // Check expiration
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return { valid: false, error: "This coupon has expired" };
    }

    // Check global usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, error: "This coupon has reached its usage limit" };
    }

    // Check per-user limit
    if (userId && coupon.perUserLimit) {
      const userUsageCount = await this.couponRepo.getUserUsageCount(
        coupon.id,
        userId
      );
      if (userUsageCount >= coupon.perUserLimit) {
        return {
          valid: false,
          error:
            "You have already used this coupon the maximum number of times",
        };
      }
    }

    // Check minimum purchase
    const minPurchase = coupon.minPurchaseAmount
      ? parseFloat(coupon.minPurchaseAmount)
      : 0;
    if (subtotal < minPurchase) {
      return {
        valid: false,
        error: `Minimum purchase of $${minPurchase.toFixed(2)} required`,
      };
    }

    // Calculate discount
    let discountAmount = 0;
    const discountValue = parseFloat(coupon.discountValue);

    if (coupon.discountType === "percentage") {
      discountAmount = (subtotal * discountValue) / 100;
    } else {
      // Fixed amount
      discountAmount = discountValue;
    }

    // Apply max discount cap if set
    const maxDiscount = coupon.maxDiscountAmount
      ? parseFloat(coupon.maxDiscountAmount)
      : Infinity;
    discountAmount = Math.min(discountAmount, maxDiscount);

    // Don't exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);

    return {
      valid: true,
      coupon,
      discountAmount: Math.round(discountAmount * 100) / 100,
    };
  }
}
