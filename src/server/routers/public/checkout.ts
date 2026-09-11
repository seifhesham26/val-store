/**
 * Checkout Router
 *
 * tRPC router for checkout and payment operations.
 * All procedures require authentication (protectedProcedure).
 *
 * Cash on delivery is the only payment method — Stripe was removed (see
 * `docs/ISSUES.md` history) and no replacement gateway is wired in yet.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../trpc";
import { container } from "@/application/container";
import { clearHeldCouponIfDead } from "@/server/utils/clear-dead-coupon";

export const checkoutRouter = router({
  /**
   * Create a Cash on Delivery order
   */
  createCodOrder: protectedProcedure
    .input(
      z.object({
        shippingAddressId: z.string().min(1),
        // Required, not defaulted server-side: the client always makes an
        // explicit choice (the "same as shipping" checkbox, checked by
        // default, sends shippingAddressId back here itself).
        billingAddressId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // The cart owns the applied coupon. Taking it from the request as well
      // would be a second source of truth, and the client controls that one.
      const held = await container
        .getCartRepository()
        .getAppliedCoupon(ctx.user.id);

      const useCase = container.getCreateOrderUseCase();

      try {
        const { order } = await useCase.execute({
          userId: ctx.user.id,
          shippingAddressId: input.shippingAddressId,
          billingAddressId: input.billingAddressId,
          paymentMethod: "cash_on_delivery",
          couponCode: held?.code,
          customerEmail: ctx.user.email,
        });

        return { orderId: order.id };
      } catch (error) {
        // The use case throws rather than silently charging full price when
        // the coupon cannot be honoured — but the throw says nothing about
        // *why*, and most of the reasons are not the coupon's fault. Ask the
        // validator, and drop the held code only if it is genuinely dead.
        if (held) {
          // Only a dead coupon is dropped, and this swallows its own
          // failures — the error below is the one that must reach the caller.
          await clearHeldCouponIfDead(
            {
              cartRepository: container.getCartRepository(),
              validateCoupon: container.getValidateCouponUseCase(),
            },
            ctx.user.id,
            held.code
          );
        }
        throw error;
      }
    }),
});
