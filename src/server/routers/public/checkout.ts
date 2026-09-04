/**
 * Checkout Router
 *
 * tRPC router for checkout and payment operations.
 * All procedures require authentication (protectedProcedure).
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../trpc";
import { container } from "@/application/container";
import { isTransientCouponRejection } from "@/application/coupons/use-cases/validate-coupon.use-case";
import { db } from "@/db";
import { orders } from "@/db/schema";
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

      const useCase = container.getCreateCheckoutSessionUseCase();

      try {
        return await useCase.execute({
          userId: ctx.user.id,
          email: ctx.user.email,
          shippingAddressId: input.shippingAddressId,
          billingAddressId: input.billingAddressId,
          couponCode: held?.code,
        });
      } catch (error) {
        // The use case throws rather than silently charging full price when
        // the coupon cannot be honoured — but the throw says nothing about
        // *why*, and most of the reasons are not the coupon's fault. Ask the
        // validator, and drop the held code only if it is genuinely dead.
        if (held) {
          try {
            const subtotal = await container
              .getCartRepository()
              .getCartTotal(ctx.user.id);
            const verdict = await container
              .getValidateCouponUseCase()
              .execute(held.code, subtotal, ctx.user.id);

            // Only a dead coupon is dropped. A cart that is merely ineligible
            // right now is the same condition GetCartUseCase deliberately
            // keeps, and an error that had nothing to do with the coupon
            // (stock, a bad address) comes back valid and leaves it alone.
            if (!verdict.valid && !isTransientCouponRejection(verdict.reason)) {
              await container
                .getCartRepository()
                .clearAppliedCoupon(ctx.user.id);
            }
          } catch (clearError) {
            // Never let the cleanup's failure replace the error that
            // explains what actually went wrong.
            console.error(
              "[Checkout] classifying the applied coupon failed:",
              clearError instanceof Error
                ? clearError.message
                : String(clearError)
            );
          }
        }
        throw error;
      }
    }),

  /**
   * Create a Cash on Delivery order (no Stripe)
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
      // See createSession: the cart is the only place the applied code lives.
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
          // The card path gets the address from the Stripe session; COD has no
          // gateway to ask, so the confirmation address comes from the session
          // user here.
          customerEmail: ctx.user.email,
        });

        return { orderId: order.id };
      } catch (error) {
        // See createSession: the throw says nothing about why the coupon
        // could not be honoured, so classify it before clearing and drop
        // only a genuinely dead code.
        if (held) {
          try {
            const subtotal = await container
              .getCartRepository()
              .getCartTotal(ctx.user.id);
            const verdict = await container
              .getValidateCouponUseCase()
              .execute(held.code, subtotal, ctx.user.id);

            // Only a dead coupon is dropped. A cart that is merely ineligible
            // right now is the same condition GetCartUseCase deliberately
            // keeps, and an error that had nothing to do with the coupon
            // (stock, a bad address) comes back valid and leaves it alone.
            if (!verdict.valid && !isTransientCouponRejection(verdict.reason)) {
              await container
                .getCartRepository()
                .clearAppliedCoupon(ctx.user.id);
            }
          } catch (clearError) {
            // Never let the cleanup's failure replace the error that
            // explains what actually went wrong.
            console.error(
              "[Checkout] classifying the applied coupon failed:",
              clearError instanceof Error
                ? clearError.message
                : String(clearError)
            );
          }
        }
        throw error;
      }
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
      // Same anomaly the webhook logs — whichever of the two gets here
      // first is the one that records it.
      if (paid.couponLimitExceeded) {
        console.error(
          JSON.stringify({
            error: "Coupon redeemed past its limit",
            orderId,
            orderNumber: paid.orderNumber,
          })
        );
      }

      if (paid.transitioned) {
        await container.getNotificationService().orderStatusChanged({
          orderId,
          orderNumber: paid.orderNumber,
          userId: paid.userId ?? ctx.user.id,
          status: "paid",
        });
      }

      await container.getCartRepository().clearCart(ctx.user.id);

      return { paid: true, orderId: order.id, status: "paid" as const };
    }),
});
