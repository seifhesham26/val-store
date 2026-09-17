import { container } from "@/application/container";
import { z } from "zod";
import {
  router,
  adminProcedure,
  adminWriteProcedure,
  customerDirectoryProcedure,
} from "../../trpc";
import { ORDER_STATUSES } from "@/domain/orders/value-objects/order-status.value-object";
import {
  ACTIVE_FULFILLMENT_STATUSES,
  isActiveFulfillmentStatus,
} from "@/domain/customer-access/customer-access-policy";
import { redactOrderListForRole } from "@/application/customer-access/staff-order-access.service";
import { TRPCError } from "@trpc/server";
import { CustomerAccessDeniedError } from "@/domain/customer-access/customer-access-denied.error";
import { InventoryQuarantineError } from "@/domain/orders/exceptions/inventory-quarantine.error";
import { revalidateCatalogue } from "@/server/utils/revalidate-catalogue";
import { revalidateAfterExpiredCheckoutSweep } from "@/server/utils/revalidate-expired-checkout-sweep";

/**
 * Orders Router - Thin Adapter
 *
 * Delegates all business logic to use cases.
 * Protected with admin-only access.
 */

const listOrdersSchema = z
  .object({
    userId: z.string().optional(),
    // Same domain source as `updateOrderStatusSchema` below. A bare
    // `z.string()` reaches Postgres as a comparison against the native
    // `order_status` enum, so anything outside the enum raises `invalid input
    // value for enum order_status` — a 500 on the admin orders table where a
    // validation error belongs.
    status: z.enum(ORDER_STATUSES).optional(),
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
  supportAccessId: z.string().uuid().optional(),
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
  list: adminProcedure.input(listOrdersSchema).query(async ({ ctx, input }) => {
    // Release abandoned checkouts without blocking the list on it — the sweep
    // makes Stripe API calls, and awaiting them put a third-party round trip in
    // front of every admin page load. Throttled to once a minute per process
    // and error-swallowing, so firing and forgetting is safe.
    revalidateAfterExpiredCheckoutSweep(
      container.getCancelExpiredCheckoutsUseCase().execute()
    );

    const useCase = container.getListOrdersUseCase();
    const page = input?.cursor ?? 1;
    if (
      ctx.user.role === "worker" &&
      input?.status &&
      !isActiveFulfillmentStatus(input.status)
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Use customer-requested support lookup for historical orders",
      });
    }

    const result = await useCase.execute({
      ...input,
      statuses:
        ctx.user.role === "worker" && !input?.status
          ? [...ACTIVE_FULFILLMENT_STATUSES]
          : undefined,
      includeCustomerEmail: ctx.user.role !== "worker",
      page,
      limit: input?.limit ?? 10,
    });

    return redactOrderListForRole(result, ctx.user.role);
  }),

  // Get single order by ID
  getById: adminProcedure
    .input(getOrderSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await container.getOpenStaffOrderUseCase().execute({
          actor: {
            id: ctx.user.id,
            name: ctx.user.name,
            email: ctx.user.email,
            role: ctx.user.role,
          },
          orderId: input.id,
          supportAccessId: input.supportAccessId ?? null,
        });
      } catch (error) {
        if (!(error instanceof CustomerAccessDeniedError)) throw error;
        throw new TRPCError({
          code: "FORBIDDEN",
          message: error.message,
        });
      }
    }),

  /** Reveal delivery data only after authorization and audit persistence. */
  revealDelivery: adminProcedure
    .input(getOrderSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await container.getRevealOrderDeliveryUseCase().execute({
          actor: {
            id: ctx.user.id,
            name: ctx.user.name,
            email: ctx.user.email,
            role: ctx.user.role,
          },
          orderId: input.id,
          supportAccessId: input.supportAccessId ?? null,
        });
      } catch (error) {
        if (!(error instanceof CustomerAccessDeniedError)) throw error;
        throw new TRPCError({
          code: "FORBIDDEN",
          message: error.message,
        });
      }
    }),

  /** Record authorization before the browser creates a portable CSV copy. */
  recordExport: customerDirectoryProcedure.mutation(async ({ ctx }) => {
    await container.getRecordCustomerAccessUseCase().execute({
      actorUserId: ctx.user.id,
      actorName: ctx.user.name,
      actorEmail: ctx.user.email,
      actorRole: ctx.user.role,
      subjectUserId: null,
      orderId: null,
      action: "order_export",
      fieldGroup: "bulk_order_data",
      reason: "operations_export",
      reasonNote: null,
      confirmedCustomerRequest: false,
    });

    return { authorized: true as const };
  }),

  /**
   * Record a return. Bounds are enforced against the order itself — you cannot
   * return more than was ordered, nor more than is left to return.
   */
  refund: adminWriteProcedure
    .input(refundOrderSchema)
    .mutation(async ({ input }) => {
      const useCase = container.getRefundOrderUseCase();
      const result = await useCase.execute(input);
      revalidateCatalogue();
      return result;
    }),

  // Update order status
  updateStatus: adminWriteProcedure
    .input(updateOrderStatusSchema)
    .mutation(async ({ input }) => {
      const useCase = container.getUpdateOrderStatusUseCase();
      try {
        const result = await useCase.execute(input);
        if (input.status === "cancelled") revalidateCatalogue();
        return result;
      } catch (error) {
        if (!(error instanceof InventoryQuarantineError)) throw error;
        throw new TRPCError({
          code: "CONFLICT",
          message:
            error.message +
            ". Resolve the inventory request before marking this order shipped.",
        });
      }
    }),
});
