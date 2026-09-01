import { container } from "@/application/container";
import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import { ORDER_STATUSES } from "@/domain/orders/value-objects/order-status.value-object";

/**
 * Orders Router - Thin Adapter
 *
 * Delegates all business logic to use cases.
 * Protected with admin-only access.
 */

const listOrdersSchema = z
  .object({
    userId: z.string().optional(),
    status: z.string().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    minTotal: z.number().optional(),
    maxTotal: z.number().optional(),
    refundableOnly: z.boolean().optional(),
    returnedOnly: z.boolean().optional(),
    limit: z.number().min(1).max(100).optional().default(10),
    cursor: z.number().min(1).optional(), // Page number as cursor
  })
  .optional();

const getOrderSchema = z.object({
  id: z.string().uuid(),
});

const updateOrderStatusSchema = z.object({
  id: z.string().uuid(),
  // Sourced from the domain so this can never drift from the DB enum again.
  status: z.enum(ORDER_STATUSES),
  reason: z.string().trim().max(500).optional(),
  // Omit to restock the whole order; pass an explicit list (even empty) to
  // restock only part of it.
  restock: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.number().int().min(0),
      })
    )
    .optional(),
});

/**
 * A return is recorded per line, with two separate numbers: how many units the
 * customer is refunded for, and how many of those are fit to sell again.
 */
const refundOrderSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
  lines: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        returned: z.number().int().min(0),
        restocked: z.number().int().min(0),
      })
    )
    .min(1),
});

export const ordersRouter = router({
  // List orders with filtering and pagination
  list: adminProcedure.input(listOrdersSchema).query(async ({ input }) => {
    // Release abandoned checkouts without blocking the list on it — the sweep
    // makes Stripe API calls, and awaiting them put a third-party round trip in
    // front of every admin page load. Throttled to once a minute per process
    // and error-swallowing, so firing and forgetting is safe.
    void container.getCancelExpiredCheckoutsUseCase().execute();

    const useCase = container.getListOrdersUseCase();
    const page = input?.cursor ?? 1;
    return useCase.execute({
      ...input,
      page,
      limit: input?.limit ?? 10,
    });
  }),

  // Get single order by ID
  getById: adminProcedure.input(getOrderSchema).query(async ({ input }) => {
    const useCase = container.getGetOrderUseCase();
    return useCase.execute(input);
  }),

  /**
   * Record a return. Bounds are enforced against the order itself — you cannot
   * return more than was ordered, nor more than is left to return.
   */
  refund: adminProcedure
    .input(refundOrderSchema)
    .mutation(async ({ input }) => {
      const useCase = container.getRefundOrderUseCase();
      return useCase.execute(input);
    }),

  // Update order status
  updateStatus: adminProcedure
    .input(updateOrderStatusSchema)
    .mutation(async ({ input }) => {
      const useCase = container.getUpdateOrderStatusUseCase();
      return useCase.execute(input);
    }),
});
