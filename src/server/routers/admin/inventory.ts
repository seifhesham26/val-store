/**
 * Admin Inventory Router
 *
 * Manage stock levels, view logs, adjust inventory.
 */

import { router, adminProcedure } from "@/server/trpc";
import { z } from "zod/v4";
import { DrizzleInventoryRepository } from "@/infrastructure/database/repositories/inventory.repository";
import { AdjustStockUseCase } from "@/application/inventory/use-cases/adjust-stock.use-case";
import { TRPCError } from "@trpc/server";
import { inventoryChangeTypeEnum } from "@/db/schema";

const inventoryRepo = new DrizzleInventoryRepository();
const adjustStockUseCase = new AdjustStockUseCase(inventoryRepo);

export const adminInventoryRouter = router({
  /**
   * Get all variants with stock levels
   */
  listVariants: adminProcedure.query(async () => {
    return inventoryRepo.getAllVariantsWithStock();
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
  adjustStock: adminProcedure
    .input(
      z.object({
        variantId: z.string().uuid(),
        newQuantity: z.number().int().min(0),
        changeType: z.enum(inventoryChangeTypeEnum.enumValues),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await adjustStockUseCase.execute({
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
