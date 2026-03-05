/**
 * Create Checkout Session Use Case
 *
 * Creates a Stripe checkout session from cart items.
 * Order is created on successful payment via webhook.
 */

import { CartRepositoryInterface } from "@/domain/interfaces/repositories/cart.repository.interface";
import { stripeService } from "@/infrastructure/services/stripe.service";
import { CreateOrderUseCase } from "./create-order.use-case";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface CreateCheckoutSessionInput {
  userId: string;
  email: string;
  shippingAddressId: string;
}

export interface CreateCheckoutSessionOutput {
  sessionId: string;
  url: string;
}

export class CreateCheckoutSessionUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryInterface,
    private readonly createOrderUseCase: CreateOrderUseCase
  ) {}

  async execute(
    input: CreateCheckoutSessionInput
  ): Promise<CreateCheckoutSessionOutput> {
    const { userId, email, shippingAddressId } = input;

    // Ensure cart exists (CreateOrderUseCase also checks, but we want to avoid creating sessions for empty carts)
    const cartItems = await this.cartRepository.findByUserId(userId);

    if (cartItems.length === 0) {
      throw new Error("Cart is empty");
    }

    // Create a pending order in DB first, then use its ID for Stripe metadata
    const { order } = await this.createOrderUseCase.execute({
      userId,
      shippingAddressId,
      paymentMethod: "stripe",
    });

    // Build success/cancel URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const successUrl = `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/cart`;

    // Create Stripe Checkout Session
    const session = await stripeService.createCheckoutSession({
      lineItems: cartItems.map((item) => ({
        productName: item.productName,
        productId: item.productId,
        unitAmount: Math.round(item.productPrice * 100), // Convert to cents
        quantity: item.quantity,
        imageUrl: item.productImage || undefined,
      })),
      orderId: order.id,
      customerEmail: email,
      successUrl,
      cancelUrl,
      metadata: {
        userId,
      },
    });

    await db
      .update(payments)
      .set({
        transactionId: session.sessionId,
        paymentGatewayResponse: JSON.stringify({
          stripeSessionId: session.sessionId,
        }),
        updatedAt: new Date(),
      })
      .where(eq(payments.orderId, order.id));

    return {
      sessionId: session.sessionId,
      url: session.url,
    };
  }
}
