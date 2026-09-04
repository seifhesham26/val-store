/**
 * Admin Inventory Router
 *
 * Manage stock levels, view logs, adjust inventory.
 */

import { router, adminProcedure, adminWriteProcedure } from "@/server/trpc";
import { z } from "zod";
import { container } from "@/application/container";
import { TRPCError } from "@trpc/server";
import { inventoryChangeTypeEnum } from "@/db/schema";
import { DEFAULT_ADMIN_VARIANT_LIMIT } from "@/infrastructure/database/repositories/inventory/inventory.repository";

const inventoryRepo = container.getInventoryRepository();

export const adminInventoryRouter = router({
  /**
   * Get all variants with stock levels
   */
  listVariants: adminProcedure.query(async () => {
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

      return result;
    }),
});
