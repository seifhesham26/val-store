/**
 * Orders Router (Public/Customer)
 *
 * tRPC router for customer order operations.
 * All procedures require authentication.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../trpc";
import { container } from "@/application/container";
import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { pageWindow, pageCount } from "@/domain/shared/pagination";

export const ordersRouter = router({
  /**
   * Get current user's orders with infinite scroll support
   */
  getMyOrders: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).optional().default(10),
          cursor: z.number().min(1).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      // Release abandoned checkouts, but never make the customer wait for it.
      // The sweep asks Stripe about other people's orders over the network, and
      // it was awaited here — so opening "My orders" blocked on third-party
      // round trips before a single row was read. Deliberately not awaited, the
      // same call the cart's stock check already makes: the use case throttles
      // itself to once a minute per process and swallows its own errors, so at
      // worst a just-expired order shows as pending until the next load.
      void container.getCancelExpiredCheckoutsUseCase().execute();

      const orderRepository = container.getOrderRepository();
      const page = input?.cursor ?? 1;
      const { limit, offset } = pageWindow(page, input?.limit ?? 10);

      // One bounded page plus one count. This used to ask for 1000 orders on
      // every infinite-scroll page and slice ten out of them.
      const [pageOrders, total] = await Promise.all([
        orderRepository.findAll({ userId: ctx.user.id, limit, offset }),
        orderRepository.count({ userId: ctx.user.id }),
      ]);

      const totalPages = pageCount(total, limit);

      const orders = pageOrders.map((order) => ({
        id: order.id,
        // The real VLK-YYYYMMDD-XXXXXX number, which is what the confirmation
        // email quotes and what support searches by. The list used to render
        // `id.slice(-8)` — a UUID fragment that appears nowhere else.
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.totalAmount,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        lineCount: order.items.length,
        createdAt: order.createdAt,
        // An unpaid card order is held briefly and then released. The customer
        // should see that rather than watch it silently turn into "cancelled".
        awaitingPayment: order.isAwaitingPayment(),
        paymentDeadline: order.paymentDeadline(),
        // Returns are partial and derived, so a bare amount is not the whole
        // story: how many units came back, and whether anything is left.
        refundedAmount: order.refundedAmount(),
        refundedItems: order.getRefundedItems(),
        fullyRefunded: order.isFullyRefunded(),
        // Enough to recognise the order without loading a second query. The
        // repository does not join product images here, so names only.
        itemNames: order.items.slice(0, 3).map((item) => item.productName),
      }));

      return {
        orders,
        total,
        page,
        limit,
        totalPages,
      };
    }),

  /**
   * Get a specific order by ID (must belong to current user)
   */
  getOrderById: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orderRepository = container.getOrderRepository();
      const order = await orderRepository.findById(input.orderId);

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // Ensure order belongs to current user
      if (order.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      return {
        id: order.id,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        tax: order.tax,
        shippingCost: order.shippingCost,
        discount: order.discount,
        total: order.totalAmount,
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
      };
    }),

  /**
   * Get order number for the current user by order id (for checkout success page)
   */
  getOrderNumberById: protectedProcedure
    .input(z.object({ orderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await db.query.orders.findFirst({
        where: and(
          eq(orders.id, input.orderId),
          eq(orders.userId, ctx.user.id)
        ),
        columns: {
          id: true,
          orderNumber: true,
        },
      });

      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      return {
        orderId: row.id,
        orderNumber: row.orderNumber,
      };
    }),

  /**
   * Get order number for the current user by Stripe checkout session id.
   * We store the Stripe session id in payments.transactionId at session creation time.
   */
  getOrderNumberByStripeSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await db
        .select({
          orderId: orders.id,
          orderNumber: orders.orderNumber,
        })
        .from(payments)
        .innerJoin(orders, eq(payments.orderId, orders.id))
        .where(
          and(
            eq(payments.transactionId, input.sessionId),
            eq(orders.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!row[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      return row[0];
    }),
});
