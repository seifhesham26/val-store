/**
 * Drizzle Coupon Repository
 *
 * Implementation of CouponRepositoryInterface using Drizzle ORM.
 */

import { db } from "@/db";
import { coupons, couponUsages, orders, Coupon, NewCoupon } from "@/db/schema";
import { eq, sql, and, count, gte } from "drizzle-orm";
import { CouponRepositoryInterface } from "@/domain/coupons/interfaces/repositories/coupon.repository.interface";

/**
 * Ceiling on the admin coupon table, which has no pagination. Exported so the
 * router can report it next to the true total — reviews and inventory were
 * given a ceiling in an earlier pass and coupons were the one table missed.
 */
export const DEFAULT_ADMIN_COUPON_LIMIT = 200;

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

  async findAll(limit = DEFAULT_ADMIN_COUPON_LIMIT): Promise<Coupon[]> {
    return db.query.coupons.findMany({
      // `id` as the tiebreaker: `created_at` alone is not a total order, and
      // a seed writes several coupons on the same timestamp.
      orderBy: (coupons, { desc }) => [
        desc(coupons.createdAt),
        desc(coupons.id),
      ],
      limit,
    });
  }

  async countAll(): Promise<number> {
    // `COUNT(*)::int` — postgres.js decodes a bigint as a string, so the cast
    // is what makes the `number` true rather than merely asserted.
    const [row] = await db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(coupons);

    return row?.total ?? 0;
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

  async countPendingOrders(
    couponId: string,
    since: Date,
    userId?: string
  ): Promise<number> {
    const conditions = [
      eq(orders.couponId, couponId),
      eq(orders.status, "pending"),
      gte(orders.createdAt, since),
    ];

    if (userId) {
      conditions.push(eq(orders.userId, userId));
    }

    const result = await db
      .select({ count: count() })
      .from(orders)
      .where(and(...conditions));

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
