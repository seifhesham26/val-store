/**
 * Public Coupons Router
 *
 * Coupon validation for checkout.
 */

import { router, protectedProcedure } from "@/server/trpc";
import { z } from "zod/v4";
import { DrizzleCouponRepository } from "@/infrastructure/database/repositories/coupons/coupon.repository";
import { ValidateCouponUseCase } from "@/application/coupons/use-cases/validate-coupon.use-case";

const couponRepo = new DrizzleCouponRepository();
const validateCouponUseCase = new ValidateCouponUseCase(couponRepo);

export const publicCouponsRouter = router({
  /**
   * Validate a coupon code
   */
  validate: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1),
        subtotal: z.number().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await validateCouponUseCase.execute(
        input.code,
        input.subtotal,
        ctx.user.id
      );

      if (!result.valid) {
        return {
          valid: false,
          error: result.error,
        };
      }

      return {
        valid: true,
        couponId: result.coupon!.id,
        code: result.coupon!.code,
        discountType: result.coupon!.discountType,
        discountValue: result.coupon!.discountValue,
        discountAmount: result.discountAmount,
      };
    }),
});
