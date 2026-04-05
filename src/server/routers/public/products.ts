/**
 * Public Products Router
 *
 * Public endpoints for storefront product data.
 * All endpoints use publicProcedure (no auth required).
 * Returns only active products with filtered data (no cost/admin info).
 */

import { z } from "zod";
import { router, publicProcedure } from "../../trpc";
import { container } from "@/application/container";

export const publicProductsRouter = router({
  /**
   * List active products for storefront with infinite scroll support
   */
  list: publicProcedure
    .input(
      z
        .object({
          categoryId: z.string().uuid().optional(),
          gender: z.string().optional(),
          isFeatured: z.boolean().optional(),
          isOnSale: z.boolean().optional(),
          limit: z.number().min(1).max(50).optional().default(12),
          cursor: z.number().min(1).optional(), // Page number
        })
        .optional()
    )
    .query(async ({ input }) => {
      const repo = container.getProductRepository();
      const page = input?.cursor ?? 1;
      const limit = input?.limit ?? 12;
      const offset = (page - 1) * limit;

      let allProducts = await repo.findAll({
        isActive: true,
        categoryId: input?.categoryId,
        isFeatured: input?.isFeatured,
      });

      // Filter by gender if provided
      if (input?.gender) {
        allProducts = allProducts.filter((p) => p.gender === input.gender);
      }

      // Filter by on sale if requested
      if (input?.isOnSale) {
        allProducts = allProducts.filter(
          (p) => p.salePrice !== null && p.salePrice < p.basePrice
        );
      }

      const total = allProducts.length;
      const totalPages = Math.ceil(total / limit);

      // Get primary images and variants for the page products
      const imageRepo = container.getProductImageRepository();
      const variantRepo = container.getProductVariantRepository();
      const pageProducts = allProducts.slice(offset, offset + limit);

      // Return only public-safe data with images and variants
      const products = await Promise.all(
        pageProducts.map(async (p) => {
          const [images, variants] = await Promise.all([
            imageRepo.findByProduct(p.id),
            variantRepo.findByProduct(p.id),
          ]);
          const primaryImage = images.find((img) => img.isPrimary) || images[0];
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            description: p.description,
            basePrice: p.basePrice,
            salePrice: p.salePrice,
            categoryId: p.categoryId,
            gender: p.gender,
            isFeatured: p.isFeatured,
            primaryImage: primaryImage?.imageUrl ?? null,
            variants: variants
              .filter((v) => v.isAvailable)
              .map((v) => ({
                id: v.id,
                size: v.size,
                color: v.color,
                inStock: v.stockQuantity > 0,
              })),
          };
        })
      );

      return {
        products,
        total,
        page,
        limit,
        totalPages,
      };
    }),

  /**
   * Get product by slug (public detail page)
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const repo = container.getProductRepository();
      const product = await repo.findBySlug(input.slug);

      if (!product || !product.isActive) {
        return null;
      }

      // Get images and variants
      const imageRepo = container.getProductImageRepository();
      const variantRepo = container.getProductVariantRepository();

      const images = await imageRepo.findByProduct(product.id);
      const variants = await variantRepo.findByProduct(product.id);

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        basePrice: product.basePrice,
        salePrice: product.salePrice,
        categoryId: product.categoryId,
        gender: product.gender,
        material: product.material,
        careInstructions: product.careInstructions,
        metaTitle: product.metaTitle,
        metaDescription: product.metaDescription,
        images: images.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          altText: img.altText,
          isPrimary: img.isPrimary,
          displayOrder: img.displayOrder,
        })),
        variants: variants
          .filter((v) => v.isAvailable)
          .map((v) => ({
            id: v.id,
            size: v.size,
            color: v.color,
            priceAdjustment: v.priceAdjustment,
            inStock: v.stockQuantity > 0,
            // Note: actual stockQuantity is NOT exposed
          })),
      };
    }),

  /**
   * Get featured products for homepage
   */
  getFeatured: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(20).optional().default(8) }))
    .query(async ({ input }) => {
      const repo = container.getProductRepository();
      const imageRepo = container.getProductImageRepository();
      const products = await repo.findAll({
        isActive: true,
        isFeatured: true,
      });

      const variantRepo = container.getProductVariantRepository();

      return Promise.all(
        products.slice(0, input.limit).map(async (p) => {
          const [images, variants] = await Promise.all([
            imageRepo.findByProduct(p.id),
            variantRepo.findByProduct(p.id),
          ]);
          const primaryImage = images.find((img) => img.isPrimary) || images[0];
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            basePrice: p.basePrice,
            salePrice: p.salePrice,
            primaryImage: primaryImage?.imageUrl ?? null,
            variants: variants
              .filter((v) => v.isAvailable)
              .map((v) => ({
                id: v.id,
                size: v.size,
                color: v.color,
                inStock: v.stockQuantity > 0,
              })),
          };
        })
      );
    }),

  /**
   * Search products with infinite scroll support
   */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(50).optional().default(12),
        cursor: z.number().min(1).optional(),
      })
    )
    .query(async ({ input }) => {
      const repo = container.getProductRepository();
      const page = input.cursor ?? 1;
      const limit = input.limit ?? 12;
      const offset = (page - 1) * limit;

      const allProducts = await repo.findAll({ isActive: true });

      // Simple search - filter by name/description containing query
      const query = input.query.toLowerCase();
      const allResults = allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query))
      );

      const total = allResults.length;
      const totalPages = Math.ceil(total / limit);

      const imageRepo = container.getProductImageRepository();
      const variantRepo = container.getProductVariantRepository();

      const products = await Promise.all(
        allResults.slice(offset, offset + limit).map(async (p) => {
          const [images, variants] = await Promise.all([
            imageRepo.findByProduct(p.id),
            variantRepo.findByProduct(p.id),
          ]);
          const primaryImage = images.find((img) => img.isPrimary) || images[0];
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            basePrice: p.basePrice,
            salePrice: p.salePrice,
            primaryImage: primaryImage?.imageUrl ?? null,
            variants: variants
              .filter((v) => v.isAvailable)
              .map((v) => ({
                id: v.id,
                size: v.size,
                color: v.color,
                inStock: v.stockQuantity > 0,
              })),
          };
        })
      );

      return {
        products,
        total,
        page,
        limit,
        totalPages,
      };
    }),
});
