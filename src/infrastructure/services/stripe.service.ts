/**
 * Stripe Service
 *
 * Server-side Stripe integration for payment processing.
 */

import Stripe from "stripe";
import { STRIPE_CURRENCY } from "@/lib/currency";

// What Stripe charges in. Shared with the order rows and every price on the
// site, so the three can no longer disagree.
const CHECKOUT_CURRENCY = STRIPE_CURRENCY;

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-12-15.clover",
  typescript: true,
});

export interface CreatePaymentIntentInput {
  amount: number; // in cents
  currency?: string;
  customerId?: string;
  orderId: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
}

export interface CreateCheckoutSessionInput {
  lineItems: {
    productName: string;
    productId: string;
    unitAmount: number; // in cents
    quantity: number;
    imageUrl?: string;
  }[];
  orderId: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  /** Discount to apply, in major units (e.g. 12.50). Omit or 0 for none. */
  discountAmount?: number;
  /** Coupon code behind the discount, used to name it in the Stripe dashboard. */
  discountLabel?: string;
}

export interface CreateCheckoutSessionResult {
  sessionId: string;
  url: string;
}

export class StripeService {
  /**
   * Create a Payment Intent for custom checkout flow
   */
  async createPaymentIntent(
    input: CreatePaymentIntentInput
  ): Promise<CreatePaymentIntentResult> {
    const {
      amount,
      // The store's currency, not a dollar default — a payment intent created
      // without an explicit currency used to be charged in USD.
      currency = STRIPE_CURRENCY,
      orderId,
      metadata = {},
    } = input;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        orderId,
        ...metadata,
      },
    });

    if (!paymentIntent.client_secret) {
      throw new Error("Failed to create payment intent");
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * Create a Stripe Checkout Session (hosted checkout)
   */
  async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CreateCheckoutSessionResult> {
    const {
      lineItems,
      orderId,
      customerEmail,
      successUrl,
      cancelUrl,
      metadata = {},
      discountAmount = 0,
      discountLabel,
    } = input;

    // Stripe rejects negative line items, so a coupon discount has to be applied
    // as an actual Stripe coupon. Created per-session and used once.
    const discountMinorUnits = Math.round(discountAmount * 100);
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;

    if (discountMinorUnits > 0) {
      // Stripe caps a coupon name at 40 characters and an order id alone is 36,
      // so the id belongs in metadata; the name stays short and readable in the
      // Stripe dashboard.
      const label = discountLabel
        ? `Coupon ${discountLabel}`
        : "Order discount";

      const stripeCoupon = await stripe.coupons.create({
        amount_off: discountMinorUnits,
        currency: CHECKOUT_CURRENCY,
        duration: "once",
        name: label.slice(0, 40),
        metadata: { orderId },
      });
      discounts = [{ coupon: stripeCoupon.id }];
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems.map((item) => ({
        price_data: {
          currency: CHECKOUT_CURRENCY,
          product_data: {
            name: item.productName,
            images: item.imageUrl ? [item.imageUrl] : [],
            metadata: {
              productId: item.productId,
            },
          },
          unit_amount: item.unitAmount,
        },
        quantity: item.quantity,
      })),
      customer_email: customerEmail,
      discounts,
      // The order reserves its stock before this redirect, so an abandoned
      // checkout holds inventory. Stripe's default window is 24 hours; 30
      // minutes is its minimum and far more appropriate here. Expiry fires
      // `checkout.session.expired`, which cancels the order and returns stock.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        orderId,
        ...metadata,
      },
    });

    if (!session.url) {
      throw new Error("Failed to create checkout session");
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  /**
   * Retrieve a payment intent
   */
  async getPaymentIntent(paymentIntentId: string) {
    return stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Retrieve a checkout session
   */
  async getCheckoutSession(sessionId: string) {
    return stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "payment_intent"],
    });
  }

  /**
   * Construct webhook event from request
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string
  ): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}

// Export singleton instance
export const stripeService = new StripeService();
