/**
 * Notification Service
 *
 * The single writer for both notification tables. Everything else in the app
 * only had readers: the bells, the mark-as-read endpoints and the delete
 * endpoints were all complete, and nothing ever produced a row for them.
 *
 * **Every method here swallows its own failures.** A notification is a courtesy;
 * an order is not. If the insert fails, the checkout that triggered it must
 * still succeed, so each emit is wrapped and logged rather than thrown.
 */

import { NotificationsRepositoryInterface } from "@/domain/notifications/interfaces/repositories/notifications.repository.interface";
import { UserNotificationsRepositoryInterface } from "@/domain/notifications/interfaces/repositories/user-notifications.repository.interface";
import { InventoryRepositoryInterface } from "@/domain/inventory/interfaces/repositories/inventory.repository.interface";
import { formatCurrency } from "@/lib/currency";

/** Statuses a customer is worth telling about, and what to say. */
const STATUS_NOTIFICATIONS = {
  paid: {
    type: "order_confirmed",
    title: "Payment received",
    message: (orderNumber: string) =>
      `We have your payment for ${orderNumber}. We'll let you know when it ships.`,
  },
  processing: {
    type: "order_update",
    title: "Order being prepared",
    message: (orderNumber: string) => `${orderNumber} is being packed.`,
  },
  shipped: {
    type: "order_shipped",
    title: "Order shipped",
    message: (orderNumber: string) => `${orderNumber} is on its way.`,
  },
  delivered: {
    type: "order_delivered",
    title: "Order delivered",
    message: (orderNumber: string) => `${orderNumber} has been delivered.`,
  },
  cancelled: {
    type: "order_cancelled",
    title: "Order cancelled",
    message: (orderNumber: string) => `${orderNumber} has been cancelled.`,
  },
  refunded: {
    type: "refund_processed",
    title: "Refund processed",
    message: (orderNumber: string) =>
      `Your refund for ${orderNumber} has been processed.`,
  },
} as const;

/** At or below this many units left, admins get told — once, on the way down. */
export const LOW_STOCK_THRESHOLD = 5;

/**
 * Did this movement take the variant into low-stock territory?
 *
 * Deliberately a crossing rather than a level: without it, every subsequent
 * sale of an already-low variant would notify again.
 */
function crossedLowStock(previous: number, next: number): boolean {
  return previous > LOW_STOCK_THRESHOLD && next <= LOW_STOCK_THRESHOLD;
}

export class NotificationService {
  constructor(
    private readonly adminNotifications: NotificationsRepositoryInterface,
    private readonly userNotifications: UserNotificationsRepositoryInterface,
    private readonly inventory: InventoryRepositoryInterface
  ) {}

  /**
   * A customer placed an order: tell every admin, and confirm it to the buyer.
   */
  async orderPlaced(input: {
    orderId: string;
    orderNumber: string | null;
    userId: string;
    total: number;
    itemCount: number;
  }): Promise<void> {
    const label = input.orderNumber ?? input.orderId.slice(0, 8).toUpperCase();

    await this.safely("orderPlaced", async () => {
      await this.fanOutToAdmins({
        notificationType: "new_order",
        title: "New order",
        message: `${label} — ${input.itemCount} item${
          input.itemCount === 1 ? "" : "s"
        }, ${formatCurrency(input.total)}`,
        relatedEntityId: input.orderId,
      });

      await this.userNotifications.create({
        userId: input.userId,
        notificationType: "order_confirmed",
        title: "Order placed",
        message: `We've received ${label}. Thank you.`,
      });
    });
  }

  /**
   * An order changed status. Statuses the customer cannot act on are skipped.
   */
  async orderStatusChanged(input: {
    orderId: string;
    orderNumber: string | null;
    userId: string | null;
    status: string;
  }): Promise<void> {
    if (!input.userId) return;

    const template =
      STATUS_NOTIFICATIONS[input.status as keyof typeof STATUS_NOTIFICATIONS];
    if (!template) return;

    const label = input.orderNumber ?? input.orderId.slice(0, 8).toUpperCase();

    await this.safely("orderStatusChanged", () =>
      this.userNotifications.create({
        userId: input.userId!,
        notificationType: template.type,
        title: template.title,
        message: template.message(label),
      })
    );
  }

  /**
   * A return was recorded against an order.
   *
   * Separate from `orderStatusChanged` because a partial return is not a status
   * change — returning one of three shirts leaves the order where it was — so
   * the status hook never fired and the customer was told nothing at all. The
   * amount is the money moved by *this* return, not the running total, because
   * that is the number the customer is waiting to see back on their card.
   */
  async orderRefunded(input: {
    orderId: string;
    orderNumber: string | null;
    userId: string | null;
    /** Money returned by this return alone. */
    amount: number;
    fullyRefunded: boolean;
  }): Promise<void> {
    if (!input.userId) return;
    // A return that moved no money (all lines restocked at zero value, or a
    // no-op call) is not worth a notification.
    if (input.amount <= 0) return;

    const label = input.orderNumber ?? input.orderId.slice(0, 8).toUpperCase();

    await this.safely("orderRefunded", () =>
      this.userNotifications.create({
        userId: input.userId!,
        notificationType: "refund_processed",
        title: input.fullyRefunded ? "Refund processed" : "Partial refund",
        message: input.fullyRefunded
          ? `${formatCurrency(input.amount)} for ${label} has been refunded.`
          : `${formatCurrency(
              input.amount
            )} of ${label} has been refunded for the items you returned.`,
      })
    );
  }

  /**
   * Stock fell to or below the threshold. Only fires on the crossing, so a
   * variant that is already low does not notify on every subsequent sale.
   */
  async stockChanged(input: {
    variantId: string;
    previousQuantity: number;
    newQuantity: number;
  }): Promise<void> {
    if (!crossedLowStock(input.previousQuantity, input.newQuantity)) return;

    await this.safely("stockChanged", async () => {
      const [variant] = await this.inventory.getVariantsStock([
        input.variantId,
      ]);
      await this.emitLowStock(
        input.variantId,
        variant?.sku ?? "A variant",
        input.newQuantity
      );
    });
  }

  /**
   * Units left the shelf because someone bought them.
   *
   * Sales are decremented inside the order transaction, in the repository,
   * which has no notifier — so the check happens here, after the order has
   * committed. The quantity sold gives the pre-sale level, so the same
   * crossing rule applies as for a manual adjustment.
   */
  async stockSold(
    sold: { variantId: string; quantity: number }[]
  ): Promise<void> {
    const lines = sold.filter((line) => line.variantId);
    if (lines.length === 0) return;

    await this.safely("stockSold", async () => {
      const variants = await this.inventory.getVariantsStock(
        lines.map((line) => line.variantId)
      );
      const soldByVariant = new Map(
        lines.map((line) => [line.variantId, line.quantity])
      );

      for (const variant of variants) {
        const quantity = soldByVariant.get(variant.id) ?? 0;
        const previous = variant.stockQuantity + quantity;
        if (!crossedLowStock(previous, variant.stockQuantity)) continue;

        await this.emitLowStock(variant.id, variant.sku, variant.stockQuantity);
      }
    });
  }

  private async emitLowStock(
    variantId: string,
    sku: string,
    remaining: number
  ): Promise<void> {
    await this.fanOutToAdmins({
      notificationType: "low_stock",
      title: remaining === 0 ? "Out of stock" : "Low stock",
      message:
        remaining === 0
          ? `${sku} has sold out.`
          : `${sku} is down to ${remaining} unit${remaining === 1 ? "" : "s"}.`,
      relatedEntityId: variantId,
    });
  }

  /**
   * A review was submitted. Reviews need approval, so this is the queue signal.
   */
  async reviewSubmitted(input: {
    reviewId: string;
    productName: string;
    rating: number;
    isVerifiedPurchase: boolean;
  }): Promise<void> {
    await this.safely("reviewSubmitted", () =>
      this.fanOutToAdmins({
        notificationType: "new_review",
        title: "New review awaiting approval",
        message: `${input.rating}★ on ${input.productName}${
          input.isVerifiedPurchase ? " (verified purchase)" : ""
        }`,
        relatedEntityId: input.reviewId,
      })
    );
  }

  /**
   * A payment failed at the provider. Admin-only: the customer already saw it.
   */
  async paymentFailed(input: {
    orderId: string | null;
    orderNumber: string | null;
    reason?: string;
  }): Promise<void> {
    const label =
      input.orderNumber ??
      input.orderId?.slice(0, 8).toUpperCase() ??
      "unknown";

    await this.safely("paymentFailed", () =>
      this.fanOutToAdmins({
        notificationType: "failed_payment",
        title: "Payment failed",
        message: `Payment for ${label} did not go through${
          input.reason ? `: ${input.reason}` : "."
        }`,
        relatedEntityId: input.orderId ?? undefined,
      })
    );
  }

  /**
   * A new account was created.
   */
  async customerRegistered(input: {
    userId: string;
    name: string | null;
    email: string;
  }): Promise<void> {
    await this.safely("customerRegistered", () =>
      this.fanOutToAdmins({
        notificationType: "new_customer",
        title: "New customer",
        message: `${input.name?.trim() || input.email} signed up.`,
      })
    );
  }

  /** One row per admin, in a single insert. */
  private async fanOutToAdmins(notification: {
    notificationType:
      | "new_order"
      | "low_stock"
      | "new_review"
      | "failed_payment"
      | "new_customer";
    title: string;
    message: string;
    relatedEntityId?: string;
  }): Promise<void> {
    const adminIds = await this.adminNotifications.findAdminUserIds();
    if (adminIds.length === 0) return;

    await this.adminNotifications.createMany(
      adminIds.map((adminUserId) => ({ adminUserId, ...notification }))
    );
  }

  /**
   * Run an emit without letting it reach the caller.
   *
   * This is the whole safety contract of this class: notifications are written
   * from inside checkout, status changes and stock adjustments, and none of
   * those may fail because a courtesy message could not be stored.
   */
  private async safely(
    label: string,
    emit: () => Promise<unknown>
  ): Promise<void> {
    try {
      await emit();
    } catch (error) {
      console.error(`[Notifications] ${label} failed:`, error);
    }
  }
}
