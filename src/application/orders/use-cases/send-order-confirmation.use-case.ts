/**
 * Send Order Confirmation Use Case
 *
 * Builds the confirmation email from the order, not from the payment gateway.
 */

import { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import { EmailServiceInterface } from "@/application/interfaces/email.interface";
import { formatOrderAddress } from "../order-address";

export interface SendOrderConfirmationInput {
  orderId: string;
  email: string;
}

export class SendOrderConfirmationUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryInterface,
    private readonly emailService: EmailServiceInterface
  ) {}

  /**
   * Send the confirmation for an order that has just been placed or paid.
   *
   * Both payment paths call this, so a cash-on-delivery customer and a card
   * customer receive the same message with the same real `VLK-` number. The
   * Stripe handler used to build its own from the session: it sent
   * `session.id.slice(-12)` as the order number, which matched nothing the
   * customer could look up, and COD sent nothing at all while the success page
   * promised an email on both paths.
   *
   * It absorbs its own failures, for the same reason `NotificationService`
   * does: by the time this runs the money has moved and the order is
   * committed, so a mail provider being down must never surface as a failed
   * checkout.
   */
  async execute(input: SendOrderConfirmationInput): Promise<void> {
    try {
      const order = await this.orderRepository.findById(input.orderId);

      if (!order) {
        console.error("[OrderConfirmation] Order not found:", input.orderId);
        return;
      }

      await this.emailService.sendOrderConfirmation(
        input.email,
        // Assigned by the repository at insert and read back on every load,
        // so this is the number a customer can quote to support. The id is a
        // fallback that should never be reached on a persisted order.
        order.orderNumber ?? order.id,
        {
          items: order.items.map((item) => ({
            name: item.variantDetails
              ? `${item.productName} (${item.variantDetails})`
              : item.productName,
            quantity: item.quantity,
            price: item.price,
          })),
          total: order.totalAmount,
          shippingAddress: formatOrderAddress(order.shippingAddress),
        }
      );
    } catch (error) {
      console.error(
        "[OrderConfirmation] Failed to send:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
