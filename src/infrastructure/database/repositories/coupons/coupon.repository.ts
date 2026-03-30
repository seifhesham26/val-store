/**
 * Drizzle Coupon Repository
 *
 * Implementation of CouponRepositoryInterface using Drizzle ORM.
 */

import { db } from "@/db";
import { coupons, couponUsages, Coupon, NewCoupon } from "@/db/schema";
import { eq, sql, and, count } from "drizzle-orm";
import { CouponRepositoryInterface } from "@/domain/coupons/interfaces/repositories/coupon.repository.interface";

export class DrizzleCouponRepository implements CouponRepositoryInterface {
  async findById(id: string): Promise<Coupon | null> {
    const result = await db.query.coupons.findFirst({
      where: eq(coupons.id, id),
    });
    return result ?? null;
  }

  async findByCode(code: string): Promise<Coupon | null> {
    const result = await db.query.coupons.findFirst({
      where: eq(coupons.code, code.toUpperCase()),
    });
    return result ?? null;
  }

  async findAll(): Promise<Coupon[]> {
    return db.query.coupons.findMany({
      orderBy: (coupons, { desc }) => [desc(coupons.createdAt)],
    });
  }

  async create(coupon: NewCoupon): Promise<Coupon> {
    const [result] = await db
      .insert(coupons)
      .values({
        ...coupon,
        code: coupon.code.toUpperCase(),
      })
      .returning();
    return result;
  }

  async update(id: string, coupon: Partial<NewCoupon>): Promise<Coupon | null> {
    const updateData = { ...coupon, updatedAt: new Date() };
    if (coupon.code) {
      updateData.code = coupon.code.toUpperCase();
    }

    const [result] = await db
      .update(coupons)
      .set(updateData)
      .where(eq(coupons.id, id))
      .returning();
    return result ?? null;
  }

  async delete(id: string): Promise<void> {
    await db.delete(coupons).where(eq(coupons.id, id));
  }

  async incrementUsage(id: string): Promise<void> {
    await db
      .update(coupons)
      .set({
        usageCount: sql`${coupons.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(coupons.id, id));
  }

  async getUserUsageCount(couponId: string, userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(couponUsages)
      .where(
        and(
          eq(couponUsages.couponId, couponId),
          eq(couponUsages.userId, userId)
        )
      );
    return result[0]?.count ?? 0;
  }

  async recordUsage(
    couponId: string,
    userId: string,
    orderId?: string
  ): Promise<void> {
    await db.insert(couponUsages).values({
      couponId,
      userId,
      orderId: orderId ?? null,
    });
  }
}
