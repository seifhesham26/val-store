/**
 * Stripe Webhook Handler
 *
 * Handles Stripe events like checkout.session.completed.
 * Creates orders and sends confirmation emails on successful payment.
 */

import { NextRequest, NextResponse } from "next/server";
import { stripeService } from "@/infrastructure/services/stripe.service";
import { container } from "@/application/container";
import { db } from "@/db";
import { cartItems, payments } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event;

  try {
    event = stripeService.constructWebhookEvent(body, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      JSON.stringify({
        error: "Webhook signature verification failed",
        message,
      })
    );
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    );
  }

  // Handle event types
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customerEmail = session.customer_email;
      const metadata = session.metadata;

      // Persist payment + order status
      if (metadata?.orderId && session.payment_status === "paid") {
        try {
          // Shared with the success page's confirmSession: advances the order,
          // completes the payment row and redeems the coupon, guarded so a late
          // webhook cannot resurrect an order an admin already cancelled.
          const paid = await container
            .getOrderRepository()
            .markAsPaid(metadata.orderId, {
              gatewayResponse: {
                stripePaymentIntentId:
                  typeof session.payment_intent === "string"
                    ? session.payment_intent
                    : null,
              },
            });

          // Payment lands here rather than through UpdateOrderStatusUseCase, so
          // the customer's "payment received" notification is emitted here too
          // — but only on a real transition, so a redelivered webhook does not
          // notify the same customer twice.
          if (paid.transitioned) {
            await container.getNotificationService().orderStatusChanged({
              orderId: metadata.orderId,
              orderNumber: paid.orderNumber,
              userId: paid.userId ?? metadata.userId ?? null,
              status: "paid",
            });
          }
        } catch (error) {
          console.error(
            JSON.stringify({
              error: "Failed to update order/payment",
              details: error instanceof Error ? error.message : String(error),
            })
          );
        }
      }

      // Send order confirmation email, built from the order rather than from
      // this session. The session knows nothing about the VLK- order number or
      // the shipping address, which is why it used to send a slice of the
      // session id and the literal text "Address will be confirmed
      // separately". Both are on the order entity already.
      //
      // This also removes a round trip: the old code re-fetched the session
      // purely to read its line items.
      if (
        customerEmail &&
        metadata?.orderId &&
        session.payment_status === "paid"
      ) {
        await container.getSendOrderConfirmationUseCase().execute({
          orderId: metadata.orderId,
          email: customerEmail,
        });
      }

      // Clear cart if we have user info
      if (metadata?.userId) {
        try {
          await db
            .delete(cartItems)
            .where(eq(cartItems.userId, metadata.userId));
        } catch (error) {
          console.error(
            JSON.stringify({
              error: "Failed to clear cart",
              details: error instanceof Error ? error.message : String(error),
            })
          );
        }
      }

      break;
    }

    /**
     * The customer opened Stripe and never paid.
     *
     * The order and its stock reservation were created before the redirect, so
     * without this they sit as `pending` forever, holding inventory nobody is
     * buying. Cancelling returns the stock and releases the coupon.
     */
    case "checkout.session.expired": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;

      if (orderId) {
        try {
          await container
            .getOrderRepository()
            .updateStatus(orderId, "cancelled", {
              reason: "Checkout expired without payment",
            });

          await db
            .update(payments)
            .set({ paymentStatus: "failed", updatedAt: new Date() })
            .where(eq(payments.orderId, orderId));
        } catch (error) {
          console.error(
            JSON.stringify({
              error: "Failed to cancel expired checkout order",
              orderId,
              details: error instanceof Error ? error.message : String(error),
            })
          );
        }
      }

      break;
    }

    case "payment_intent.succeeded": {
      // The checkout.session.completed branch above already recorded the
      // payment; this arrives for the same money and needs no second write.
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object;

      // Nobody was told when a card was declined after the order row existed.
      // The customer sees Stripe's own message; this is for the admins, who
      // otherwise see a pending order with no explanation.
      await container.getNotificationService().paymentFailed({
        orderId: paymentIntent.metadata?.orderId ?? null,
        orderNumber: null,
        reason:
          paymentIntent.last_payment_error?.message ??
          paymentIntent.status ??
          undefined,
      });

      break;
    }

    default:
    // Unhandled event type — no action needed
  }

  return NextResponse.json({ received: true });
}
