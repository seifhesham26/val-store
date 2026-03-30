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

// Validation schemas
const addVariantSchema = z.object({
  productId: z.string().uuid(),
  sku: z.string().min(1, "SKU is required"),
  size: z.string().optional(),
  color: z.string().optional(),
  stockQuantity: z.number().int().min(0).default(0),
  priceAdjustment: z.number().default(0),
  isAvailable: z.boolean().default(true),
});

const updateVariantSchema = z.object({
  id: z.string().uuid(),
  data: z.object({
    sku: z.string().min(1).optional(),
    size: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    stockQuantity: z.number().int().min(0).optional(),
    priceAdjustment: z.number().optional(),
    isAvailable: z.boolean().optional(),
  }),
});

const updateStockSchema = z.object({
  id: z.string().uuid(),
  quantity: z.number().int().min(0),
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
    return useCase.execute(input);
  }),

  /**
   * Update an existing variant
   */
  update: adminProcedure
    .input(updateVariantSchema)
    .mutation(async ({ input }) => {
      const repo = container.getProductVariantRepository();

      // Get existing variant
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
        input.data.stockQuantity ?? existing.stockQuantity,
        input.data.priceAdjustment ?? existing.priceAdjustment,
        input.data.isAvailable ?? existing.isAvailable,
        existing.createdAt,
        new Date()
      );

      const saved = await repo.update(updated);
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
      return { success: true };
    }),

  /**
   * Update stock quantity for a variant
   */
  updateStock: adminProcedure
    .input(updateStockSchema)
    .mutation(async ({ input }) => {
      const useCase = container.getUpdateVariantStockUseCase();
      return useCase.execute({
        variantId: input.id,
        quantity: input.quantity,
        mode: "set",
      });
    }),
});
