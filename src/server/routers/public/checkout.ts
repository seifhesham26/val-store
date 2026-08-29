/**
 * Checkout Router
 *
 * tRPC router for checkout and payment operations.
 * All procedures require authentication (protectedProcedure).
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../trpc";
import { container } from "@/application/container";

export const checkoutRouter = router({
  /**
   * Create a Stripe Checkout Session
   */
  createSession: protectedProcedure
    .input(
      z.object({
        shippingAddressId: z.string().min(1),
        couponCode: z.string().trim().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const useCase = container.getCreateCheckoutSessionUseCase();
      return useCase.execute({
        userId: ctx.user.id,
        email: ctx.user.email,
        shippingAddressId: input.shippingAddressId,
        couponCode: input.couponCode,
      });
    }),

  /**
   * Create a Cash on Delivery order (no Stripe)
   */
  createCodOrder: protectedProcedure
    .input(
      z.object({
        shippingAddressId: z.string().min(1),
        couponCode: z.string().trim().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const useCase = container.getCreateOrderUseCase();
      const { order } = await useCase.execute({
        userId: ctx.user.id,
        shippingAddressId: input.shippingAddressId,
        paymentMethod: "cash_on_delivery",
        couponCode: input.couponCode,
      });

      return { orderId: order.id };
    }),
});
