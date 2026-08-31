/**
 * Validate Coupon Use Case
 *
 * Validates a coupon code and calculates the discount amount.
 */

import { CouponRepositoryInterface } from "@/domain/coupons/interfaces/repositories/coupon.repository.interface";
import { Coupon } from "@/db/schema";
import { PAYMENT_WINDOW_MS } from "@/domain/orders/entities/order.entity";
import { formatCurrency } from "@/lib/currency";

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

    // Redemption is only recorded once a payment lands, so a coupon sitting on
    // an unpaid checkout has not been "used" yet — but it is spoken for. Count
    // those alongside real redemptions, or the same code could be carried
    // through several checkouts at once and paid for on every one.
    //
    // Only checkouts still inside the payment window count: an order about to
    // expire releases its claim on its own.
    const inFlightSince = new Date(Date.now() - PAYMENT_WINDOW_MS);

    // Check global usage limit
    if (coupon.usageLimit) {
      const pending = await this.couponRepo.countPendingOrders(
        coupon.id,
        inFlightSince
      );
      if (coupon.usageCount + pending >= coupon.usageLimit) {
        return {
          valid: false,
          error: "This coupon has reached its usage limit",
        };
      }
    }

    // Check per-user limit
    if (userId && coupon.perUserLimit) {
      const [userUsageCount, userPending] = await Promise.all([
        this.couponRepo.getUserUsageCount(coupon.id, userId),
        this.couponRepo.countPendingOrders(coupon.id, inFlightSince, userId),
      ]);

      if (userUsageCount >= coupon.perUserLimit) {
        return {
          valid: false,
          error:
            "You have already used this coupon the maximum number of times",
        };
      }

      if (userUsageCount + userPending >= coupon.perUserLimit) {
        return {
          valid: false,
          error:
            "You already have an unpaid order using this coupon. Finish paying for it, or wait for it to expire, and then try again.",
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
        error: `Minimum purchase of ${formatCurrency(minPurchase)} required`,
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
