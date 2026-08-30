/**
 * Stripe Webhook Handler
 *
 * Handles Stripe events like checkout.session.completed.
 * Creates orders and sends confirmation emails on successful payment.
 */

import { NextRequest, NextResponse } from "next/server";
import { stripeService } from "@/infrastructure/services/stripe.service";
import { ResendEmailService } from "@/infrastructure/services/resend-email.service";
import { container } from "@/application/container";
import { db } from "@/db";
import { cartItems, payments } from "@/db/schema";
import { eq } from "drizzle-orm";

const emailService = new ResendEmailService();

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
          await container.getOrderRepository().markAsPaid(metadata.orderId, {
            gatewayResponse: {
              stripePaymentIntentId:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : null,
            },
          });
        } catch (error) {
          console.error(
            JSON.stringify({
              error: "Failed to update order/payment",
              details: error instanceof Error ? error.message : String(error),
            })
          );
        }
      }

      // Send order confirmation email
      if (customerEmail && session.payment_status === "paid") {
        try {
          // Fetch line items for the email
          const fullSession = await stripeService.getCheckoutSession(
            session.id
          );
          const lineItems = fullSession.line_items?.data || [];

          const orderNumber = session.id.slice(-12).toUpperCase();
          const items = lineItems.map((item) => ({
            name: item.description || "Product",
            quantity: item.quantity || 1,
            price: (item.amount_total || 0) / 100,
          }));
          const total = (session.amount_total || 0) / 100;

          await emailService.sendOrderConfirmation(customerEmail, orderNumber, {
            items,
            total,
            shippingAddress: "Address will be confirmed separately",
          });
        } catch (error) {
          console.error(
            JSON.stringify({
              error: "Failed to send order confirmation email",
              details: error instanceof Error ? error.message : String(error),
            })
          );
        }
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
      const _paymentIntent = event.data.object;
      break;
    }

    case "payment_intent.payment_failed": {
      const _paymentIntent = event.data.object;
      break;
    }

    default:
    // Unhandled event type — no action needed
  }

  return NextResponse.json({ received: true });
}
