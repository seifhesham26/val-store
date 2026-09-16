/**
 * Admin Inventory Router
 *
 * Manage stock levels, view logs, adjust inventory.
 */

import {
  router,
  adminProcedure,
  adminWriteProcedure,
  workerProcedure,
} from "@/server/trpc";
import { z } from "zod";
import { container } from "@/application/container";
import { TRPCError } from "@trpc/server";
import { inventoryChangeTypeEnum } from "@/db/schema";
import { DEFAULT_ADMIN_VARIANT_LIMIT } from "@/infrastructure/database/repositories/inventory/inventory.repository";
import type { InventoryWorkError } from "@/domain/inventory/interfaces/repositories/inventory-requests.repository.interface";
import { revalidateCatalogue } from "@/server/utils/revalidate-catalogue";

const inventoryWorkErrorCodes = {
  forbidden: "FORBIDDEN",
  not_found: "NOT_FOUND",
  conflict: "CONFLICT",
  variant_deleted: "BAD_REQUEST",
  variant_unavailable: "BAD_REQUEST",
  invalid_category: "BAD_REQUEST",
  invalid_quantity: "BAD_REQUEST",
  invalid_explanation: "BAD_REQUEST",
  invalid_decision: "BAD_REQUEST",
  decision_explanation_required: "BAD_REQUEST",
  insufficient_stock: "BAD_REQUEST",
} satisfies Record<InventoryWorkError, TRPCError["code"]>;

function throwInventoryWorkError(error: InventoryWorkError): never {
  throw new TRPCError({
    code: inventoryWorkErrorCodes[error],
    message: error,
  });
}

export const adminInventoryRouter = router({
  /**
   * Get all variants with stock levels
   */
  listVariants: adminProcedure.query(async () => {
    const inventoryRepo = container.getInventoryRepository();
    // `total` alongside the rows so the table can say what it is not showing.
    // The cap exists because this screen has no pagination; without the total
    // it truncates in silence, and on the inventory screen that means stock an
    // admin can neither see nor edit.
    // Independent queries, so `Promise.all` pipelines them into ~1 round trip.
    const [items, total] = await Promise.all([
      inventoryRepo.getAllVariantsWithStock(),
      inventoryRepo.countAllVariants(),
    ]);

    return { items, total, limit: DEFAULT_ADMIN_VARIANT_LIMIT };
  }),

  /**
   * Get low stock variants
   */
  getLowStock: adminProcedure
    .input(
      z.object({ threshold: z.number().int().positive().optional() }).optional()
    )
    .query(async ({ input }) => {
      const inventoryRepo = container.getInventoryRepository();
      return inventoryRepo.getLowStockVariants(input?.threshold ?? 10);
    }),

  /**
   * Get inventory logs (all or by variant)
   */
  getLogs: adminProcedure
    .input(
      z
        .object({
          variantId: z.string().uuid().optional(),
          limit: z.number().int().positive().max(500).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const inventoryRepo = container.getInventoryRepository();
      if (input?.variantId) {
        return inventoryRepo.getLogsByVariant(
          input.variantId,
          input.limit ?? 50
        );
      }
      return inventoryRepo.getAllLogs(input?.limit ?? 100, input?.offset ?? 0);
    }),

  /**
   * Adjust stock for a variant
   */
  adjustStock: adminWriteProcedure
    .input(
      z.object({
        variantId: z.string().uuid(),
        newQuantity: z.number().int().min(0),
        changeType: z.enum(inventoryChangeTypeEnum.enumValues),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await container.getAdjustStockUseCase().execute({
        variantId: input.variantId,
        newQuantity: input.newQuantity,
        changeType: input.changeType,
        reason: input.reason,
        userId: ctx.user.id,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error ?? "Failed to adjust stock",
        });
      }

      revalidateCatalogue();
      return result;
    }),

  /** List pending inspections, grouped requests, and resolved history. */
  listWork: adminProcedure.query(async ({ ctx }) => {
    const result = await container.getListInventoryWorkUseCase().execute({
      actor: {
        id: ctx.user.id,
        name: ctx.user.name ?? ctx.user.email,
        role: ctx.user.role,
      },
    });
    if (!result.success) throwInventoryWorkError(result.error);
    return result.work;
  }),

  /** Count persistent pending work items for the inventory queue badge. */
  pendingCount: adminProcedure.query(async ({ ctx }) => {
    const result = await container.getListInventoryWorkUseCase().countPending({
      actor: {
        id: ctx.user.id,
        name: ctx.user.name ?? ctx.user.email,
        role: ctx.user.role,
      },
    });
    if (!result.success) throwInventoryWorkError(result.error);
    return result.count;
  }),

  /** Submit a worker-observed stock discrepancy for admin review. */
  submitRequest: workerProcedure
    .input(
      z.object({
        variantId: z.string().uuid(),
        inspectionId: z.string().uuid().optional(),
        category: z.enum(["damaged", "missing", "extra"]),
        quantity: z.number().int().positive(),
        explanation: z.string().trim().min(1).max(500),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await container
        .getSubmitAdjustmentRequestUseCase()
        .execute({
          variantId: input.variantId,
          inspectionId: input.inspectionId,
          category: input.category,
          requestedQuantity: input.quantity,
          explanation: input.explanation,
          actor: {
            id: ctx.user.id,
            name: ctx.user.name ?? ctx.user.email,
            role: ctx.user.role,
          },
        });
      if (!result.success) throwInventoryWorkError(result.error);
      if (input.category !== "extra") revalidateCatalogue();
      return result.request;
    }),

  /** Confirm that a worker inspected the low-stock units and found no flaw. */
  completeInspection: workerProcedure
    .input(z.object({ inspectionId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const result = await container
        .getCompleteInventoryInspectionUseCase()
        .execute({
          inspectionId: input.inspectionId,
          actor: {
            id: ctx.user.id,
            name: ctx.user.name ?? ctx.user.email,
            role: ctx.user.role,
          },
        });
      if (!result.success) throwInventoryWorkError(result.error);
      revalidateCatalogue();
      return result.inspection;
    }),

  /** Approve, correct, or reject a worker's pending adjustment request. */
  reviewRequest: adminWriteProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        approvedQuantity: z.number().int().positive().optional(),
        explanation: z.string().trim().min(1).max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await container
        .getReviewAdjustmentRequestUseCase()
        .execute({
          requestId: input.requestId,
          decision: input.decision,
          approvedQuantity: input.approvedQuantity,
          decisionExplanation: input.explanation,
          actor: {
            id: ctx.user.id,
            name: ctx.user.name ?? ctx.user.email,
            role: ctx.user.role,
          },
        });
      if (!result.success) throwInventoryWorkError(result.error);
      revalidateCatalogue();
      return result.request;
    }),
});
