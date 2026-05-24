import { z } from "zod";
import { adminProcedure } from "../../../trpc";
import { container } from "@/application/container";

// ============================================
// VALIDATION SCHEMAS
// ============================================

export const featuredItemSchema = z.object({
  itemType: z.enum(["product", "category"]),
  itemId: z.string().uuid(),
  section: z.string(),
  displayOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// PROCEDURES
// ============================================

export const featuredItemsProcedures = {
  getFeaturedItems: adminProcedure
    .input(z.object({ section: z.string() }))
    .query(async ({ input }) => {
      const repo = container.getSiteConfigRepository();
      const items = await repo.getFeaturedItems(input.section);
      return items.map((i) => i.toObject());
    }),

  updateFeaturedItems: adminProcedure
    .input(
      z.object({
        section: z.string(),
        items: z.array(featuredItemSchema),
      })
    )
    .mutation(async ({ input }) => {
      const repo = container.getSiteConfigRepository();
      const updated = await repo.updateFeaturedItems(
        input.section,
        input.items
      );
      return updated.map((i) => i.toObject());
    }),

  addFeaturedItem: adminProcedure
    .input(featuredItemSchema)
    .mutation(async ({ input }) => {
      const repo = container.getSiteConfigRepository();
      const added = await repo.addFeaturedItem(input);
      return added.toObject();
    }),

  removeFeaturedItem: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const repo = container.getSiteConfigRepository();
      await repo.removeFeaturedItem(input.id);
      return { success: true };
    }),

  reorderFeaturedItems: adminProcedure
    .input(
      z.object({
        section: z.string(),
        orderedIds: z.array(z.string().uuid()),
      })
    )
    .mutation(async ({ input }) => {
      const repo = container.getSiteConfigRepository();
      await repo.reorderFeaturedItems(input.section, input.orderedIds);
      return { success: true };
    }),
};
