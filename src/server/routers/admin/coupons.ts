/**
 * Admin Coupons Router
 *
 * CRUD operations for coupon management.
 */

import { router, adminProcedure } from "@/server/trpc";
import { z } from "zod/v4";
import { DrizzleCouponRepository } from "@/infrastructure/database/repositories/coupons/coupon.repository";
import { TRPCError } from "@trpc/server";

const couponRepo = new DrizzleCouponRepository();

// Optional fields are `nullish`, not merely optional: the admin form has to be
// able to *clear* a limit or an expiry, and Drizzle skips undefined keys in
// `.set()` — so "omitted" has to stay distinct from "explicitly emptied".
const couponSchema = z.object({
  code: z.string().min(3).max(50),
  description: z.string().nullish(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.string(),
  minPurchaseAmount: z.string().nullish(),
  maxDiscountAmount: z.string().nullish(),
  usageLimit: z.number().int().positive().nullish(),
  perUserLimit: z.number().int().positive().default(1),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().nullish(),
  expiresAt: z.coerce.date().nullish(),
});

export const adminCouponsRouter = router({
  /**
   * List all coupons
   */
  list: adminProcedure.query(async () => {
    return couponRepo.findAll();
  }),

  /**
   * Get a single coupon by ID
   */
  getById: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const coupon = await couponRepo.findById(input.id);
      if (!coupon) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Coupon not found" });
      }
      return coupon;
    }),

  /**
   * Create a new coupon
   */
  create: adminProcedure.input(couponSchema).mutation(async ({ input }) => {
    // Check for duplicate code
    const existing = await couponRepo.findByCode(input.code);
    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A coupon with this code already exists",
      });
    }

    return couponRepo.create(input);
  }),

  /**
   * Update an existing coupon
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: couponSchema.partial(),
      })
    )
    .mutation(async ({ input }) => {
      const coupon = await couponRepo.update(input.id, input.data);
      if (!coupon) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Coupon not found" });
      }
      return coupon;
    }),

  /**
   * Delete a coupon
   */
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await couponRepo.delete(input.id);
      return { success: true };
    }),

  /**
   * Toggle coupon active status
   */
  toggleActive: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const coupon = await couponRepo.findById(input.id);
      if (!coupon) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Coupon not found" });
      }
      return couponRepo.update(input.id, { isActive: !coupon.isActive });
    }),
});
