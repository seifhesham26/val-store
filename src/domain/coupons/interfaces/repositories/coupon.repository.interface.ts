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
  recordUsage(
    couponId: string,
    userId: string,
    orderId?: string
  ): Promise<void>;
}
