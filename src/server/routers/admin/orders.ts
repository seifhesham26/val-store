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

export const ordersRouter = router({
  // List orders with filtering and pagination
  list: adminProcedure.input(listOrdersSchema).query(async ({ input }) => {
    // Sweep abandoned checkouts so the list never shows a stale "pending" card
    // order that should already have released its stock.
    await container.getCancelExpiredCheckoutsUseCase().execute();

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

  // Update order status
  updateStatus: adminProcedure
    .input(updateOrderStatusSchema)
    .mutation(async ({ input }) => {
      const useCase = container.getUpdateOrderStatusUseCase();
      return useCase.execute(input);
    }),
});
