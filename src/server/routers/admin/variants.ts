/**
 * Product Variants Admin Router
 *
 * tRPC endpoints for managing product variants.
 * All endpoints require admin authentication.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import { container } from "@/application/container";
import { ProductVariantEntity } from "@/domain/products/entities/product-variant.entity";
import { TRPCError } from "@trpc/server";
import { revalidateCatalogue } from "@/server/utils/revalidate-catalogue";

// Validation schemas
const addVariantSchema = z.object({
  productId: z.string().uuid(),
  sku: z.string().min(1, "SKU is required").max(100),
  size: z.string().optional(),
  color: z.string().optional(),
  stockQuantity: z.number().int().min(0).default(0),
  priceAdjustment: z.number().default(0),
  isAvailable: z.boolean().default(true),
});

// Stock stays separate from the metadata fields, because they are different
// operations with different consequences: renaming a colour is not an
// inventory movement, and a stock change must leave an audit row.
//
// It is accepted here as an optional sibling rather than folded into `data`
// so one save is one request. The form used to call `update` and then
// `updateStock` from the browser, so a failure on the second left the metadata
// already saved — the same shape as the half-created product bug, smaller.
const updateVariantSchema = z.object({
  id: z.string().uuid(),
  data: z.object({
    sku: z.string().min(1).max(100).optional(),
    size: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    priceAdjustment: z.number().optional(),
    isAvailable: z.boolean().optional(),
  }),
  stock: z
    .object({
      quantity: z.number().int().min(0),
      changeType: z
        .enum(["restock", "adjustment", "damaged", "return"])
        .default("adjustment"),
      reason: z.string().max(500).optional(),
    })
    .optional(),
});

const updateStockSchema = z.object({
  id: z.string().uuid(),
  quantity: z.number().int().min(0),
  changeType: z
    .enum(["restock", "adjustment", "damaged", "return"])
    .default("adjustment"),
  reason: z.string().max(500).optional(),
});

// Helper to convert entity to plain object
function variantToOutput(variant: ProductVariantEntity) {
  return {
    id: variant.id,
    productId: variant.productId,
    sku: variant.sku,
    size: variant.size,
    color: variant.color,
    stockQuantity: variant.stockQuantity,
    priceAdjustment: variant.priceAdjustment,
    isAvailable: variant.isAvailable,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
  };
}

export const variantsRouter = router({
  /**
   * List all variants for a product
   */
  list: adminProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .query(async ({ input }) => {
      const repo = container.getProductVariantRepository();
      const variants = await repo.findByProduct(input.productId);
      return variants.map(variantToOutput);
    }),

  /**
   * Add a new variant to a product
   */
  add: adminProcedure.input(addVariantSchema).mutation(async ({ input }) => {
    const useCase = container.getAddProductVariantUseCase();
    const variant = await useCase.execute(input);
    // Cards carry their variants so Quick Add can record one, so the cached
    // grid is now missing an option a customer should be able to pick.
    revalidateCatalogue();
    return variant;
  }),

  /**
   * Update an existing variant
   */
  update: adminProcedure
    .input(updateVariantSchema)
    .mutation(async ({ input, ctx }) => {
      const repo = container.getProductVariantRepository();

      // Stock first, deliberately.
      //
      // It is the half that validates and writes the audit row, so if it
      // fails nothing at all has been written. The reverse order can leave
      // metadata saved against a stock change that was then rejected, which is
      // exactly the failure the browser-side split produced.
      //
      // Not a single database transaction: AdjustStockUseCase reaches the
      // database through InventoryRepositoryInterface, which has no
      // transaction-aware executor. Threading one through is a separate
      // refactor; this removes the two-request window without pretending to
      // atomicity it does not have.
      if (input.stock) {
        const stockResult = await container.getAdjustStockUseCase().execute({
          variantId: input.id,
          newQuantity: input.stock.quantity,
          changeType: input.stock.changeType,
          reason: input.stock.reason,
          userId: ctx.user.id,
        });

        if (!stockResult.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: stockResult.error ?? "Failed to update stock",
          });
        }
      }

      // Read after the adjustment on purpose: the entity below is rebuilt from
      // `existing.stockQuantity`, so reading first would write the pre-
      // adjustment level straight back over the change just made.
      const existing = await repo.findById(input.id);
      if (!existing) {
        throw new Error(`Variant with ID "${input.id}" not found`);
      }

      // Create updated entity
      const updated = new ProductVariantEntity(
        existing.id,
        existing.productId,
        input.data.sku ?? existing.sku,
        input.data.size !== undefined ? input.data.size : existing.size,
        input.data.color !== undefined ? input.data.color : existing.color,
        existing.stockQuantity,
        input.data.priceAdjustment ?? existing.priceAdjustment,
        input.data.isAvailable ?? existing.isAvailable,
        existing.createdAt,
        new Date()
      );

      const saved = await repo.update(updated);
      // `isAvailable` decides whether the card offers this variant at all.
      revalidateCatalogue();
      return variantToOutput(saved);
    }),

  /**
   * Delete a variant
   */
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const repo = container.getProductVariantRepository();
      await repo.delete(input.id);
      revalidateCatalogue();
      return { success: true };
    }),

  /**
   * Set a variant's stock level.
   *
   * The only way to change stock from the admin UI. Routed through
   * `AdjustStockUseCase` so every movement writes an `inventory_logs` row with
   * who did it and why — the same path the Inventory page uses.
   */
  updateStock: adminProcedure
    .input(updateStockSchema)
    .mutation(async ({ input, ctx }) => {
      const useCase = container.getAdjustStockUseCase();
      const result = await useCase.execute({
        variantId: input.id,
        newQuantity: input.quantity,
        changeType: input.changeType,
        reason: input.reason,
        userId: ctx.user.id,
      });

      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error ?? "Failed to update stock",
        });
      }

      // The cached card carries an `inStock` flag derived from this. Live
      // stock polling corrects it within 15s either way, but an admin who has
      // just restocked something should not have to wait for that.
      revalidateCatalogue();

      return result;
    }),
});
