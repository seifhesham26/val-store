/**
 * Checkout Router
 *
 * tRPC router for checkout and payment operations.
 * All procedures require authentication (protectedProcedure).
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../trpc";
import { container } from "@/application/container";
import { db } from "@/db";
import { cartItems, orders } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { stripeService } from "@/infrastructure/services/stripe.service";
import { TRPCError } from "@trpc/server";

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

  /**
   * Confirm a Stripe Checkout Session from the success page.
   *
   * The webhook is still the primary path, but it is not guaranteed: in local
   * development it never arrives unless `stripe listen` is forwarding, and in
   * production a delivery can fail or be delayed. Without this the customer
   * pays and the order sits at "pending" forever.
   *
   * Safe to call repeatedly — every write is conditional on the current state.
   */
  confirmSession: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const session = await stripeService.getCheckoutSession(input.sessionId);
      const orderId = session.metadata?.orderId;

      if (!orderId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This checkout session is not linked to an order",
        });
      }

      // The session id comes from the URL, so confirm the order really belongs
      // to the caller before touching it.
      const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.userId, ctx.user.id)),
        columns: { id: true, status: true },
      });

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      if (session.payment_status !== "paid") {
        return { paid: false, orderId: order.id, status: order.status };
      }

      // One shared path with the webhook — it advances the order, completes the
      // payment row and redeems the coupon, and is safe if both arrive.
      const paid = await container.getOrderRepository().markAsPaid(orderId);

      // Whichever of this and the webhook gets there first notifies; the other
      // sees `transitioned: false` and stays quiet.
      if (paid.transitioned) {
        await container.getNotificationService().orderStatusChanged({
          orderId,
          orderNumber: paid.orderNumber,
          userId: paid.userId ?? ctx.user.id,
          status: "paid",
        });
      }

      await db.delete(cartItems).where(eq(cartItems.userId, ctx.user.id));

      return { paid: true, orderId: order.id, status: "paid" as const };
    }),
});
