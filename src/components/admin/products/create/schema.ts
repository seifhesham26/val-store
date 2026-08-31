import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  slug: z.string().min(1, "Slug is required"),
  sku: z.string().min(1, "SKU is required").max(100, "SKU is too long"),
  description: z.string().min(1, "Description is required"),
  categoryId: z.string().uuid("Please select a category"),
  basePrice: z.number().positive("Price must be positive"),
  salePrice: z.number().positive().optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  gender: z.enum(["men", "women", "unisex", "kids"]),
  material: z.string(),
  careInstructions: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
});

export type CreateProductValues = z.infer<typeof createProductSchema>;
