/**
 * Coupon Repository Interface
 *
 * Defines contract for coupon data access.
 */

import { Coupon, NewCoupon } from "@/db/schema";

export interface CouponRepositoryInterface {
  findById(id: string): Promise<Coupon | null>;
  findByCode(code: string): Promise<Coupon | null>;
  findAll(): Promise<Coupon[]>;
  create(coupon: NewCoupon): Promise<Coupon>;
  update(id: string, coupon: Partial<NewCoupon>): Promise<Coupon | null>;
  delete(id: string): Promise<void>;
  incrementUsage(id: string): Promise<void>;
  getUserUsageCount(couponId: string, userId: string): Promise<number>;
  /**
   * Orders currently holding this coupon that have not been paid for yet.
   *
   * Redemption is only recorded once money changes hands, so without counting
   * these a customer could open several checkouts against a one-per-customer
   * code and pay every one of them. Restricted to the payment window, so an
   * order that is about to expire stops blocking on its own.
   */
  countPendingOrders(
    couponId: string,
    since: Date,
    userId?: string
  ): Promise<number>;
  recordUsage(
    couponId: string,
    userId: string,
    orderId?: string
  ): Promise<void>;
}
