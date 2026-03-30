/**
 * Admin Settings Router
 *
 * tRPC endpoints for managing site configuration.
 * All endpoints require admin authentication.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import { container } from "@/application/container";
import { revalidateTag } from "next/cache";
import {
  heroContentSchema,
  announcementContentSchema,
  promoBannerContentSchema,
  brandStoryContentSchema,
  newsletterContentSchema,
  instagramContentSchema,
} from "@/domain/site/value-objects/content-schemas";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const updateSiteSettingsSchema = z.object({
  storeName: z.string().min(1).optional(),
  storeTagline: z.string().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  faviconUrl: z.string().url().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  instagramUrl: z.string().url().nullable().optional(),
  facebookUrl: z.string().url().nullable().optional(),
  twitterUrl: z.string().url().nullable().optional(),
  tiktokUrl: z.string().url().nullable().optional(),
  currency: z.string().length(3).optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  defaultMetaTitle: z.string().nullable().optional(),
  defaultMetaDescription: z.string().nullable().optional(),
});

const sectionTypeSchema = z.enum([
  "hero",
  "announcement",
  "promo_banner",
  "brand_story",
  "newsletter",
  "instagram",
]);

const updateContentSectionSchema = z.object({
  sectionType: sectionTypeSchema,
  content: z.union([
    heroContentSchema,
    announcementContentSchema,
    promoBannerContentSchema,
    brandStoryContentSchema,
    newsletterContentSchema,
    instagramContentSchema,
  ]),
  displayOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

const featuredItemSchema = z.object({
  itemType: z.enum(["product", "category"]),
  itemId: z.string().uuid(),
  section: z.string(),
  displayOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// SETTINGS ROUTER
// ============================================

export const settingsRouter = router({
  // ==========================================
  // SITE SETTINGS
  // ==========================================

  /**
   * Get site settings
   */
  getSiteSettings: adminProcedure.query(async () => {
    const repo = container.getSiteConfigRepository();
    const settings = await repo.getSiteSettings();
    if (!settings) {
      // Initialize with defaults if not exists
      return (await repo.initializeSiteSettings()).toObject();
    }
    return settings.toObject();
  }),

  /**
   * Update site settings
   */
  updateSiteSettings: adminProcedure
    .input(updateSiteSettingsSchema)
    .mutation(async ({ input, ctx }) => {
      const repo = container.getSiteConfigRepository();
      const updated = await repo.updateSiteSettings(input, ctx.user.id);
      return updated.toObject();
    }),

  // ==========================================
  // CONTENT SECTIONS
  // ==========================================

  /**
   * Get a specific content section
   */
  getContentSection: adminProcedure
    .input(z.object({ sectionType: sectionTypeSchema }))
    .query(async ({ input }) => {
      const repo = container.getSiteConfigRepository();
      const section = await repo.getContentSection(input.sectionType);
      if (!section) {
        return null;
      }
      return {
        ...section.toObject(),
        content: JSON.parse(section.content),
      };
    }),

  /**
   * Get all content sections
   */
  getAllContentSections: adminProcedure.query(async () => {
    const repo = container.getSiteConfigRepository();
    const sections = await repo.getAllContentSections();
    return sections.map((s) => ({
      ...s.toObject(),
      content: JSON.parse(s.content),
    }));
  }),

  /**
   * Update a content section (auto-saves history)
   */
  updateContentSection: adminProcedure
    .input(updateContentSectionSchema)
    .mutation(async ({ input, ctx }) => {
      const repo = container.getSiteConfigRepository();
      const updated = await repo.updateContentSection(
        input.sectionType,
        {
          content: JSON.stringify(input.content),
          displayOrder: input.displayOrder,
          isActive: input.isActive,
        },
        ctx.user.id
      );

      // Invalidate cache for this section
      revalidateTag(`cms-${input.sectionType}`, "max");
      revalidateTag("cms-sections", "max");

      return {
        ...updated.toObject(),
        content: JSON.parse(updated.content),
      };
    }),

  /**
   * Toggle section active status
   */
  toggleSectionStatus: adminProcedure
    .input(z.object({ sectionType: sectionTypeSchema }))
    .mutation(async ({ input, ctx }) => {
      const repo = container.getSiteConfigRepository();
      const section = await repo.getContentSection(input.sectionType);
      if (!section) {
        throw new Error(`Section ${input.sectionType} not found`);
      }
      const updated = await repo.updateContentSection(
        input.sectionType,
        {
          content: section.content,
          isActive: !section.isActive,
        },
        ctx.user.id
      );
      return {
        ...updated.toObject(),
        content: JSON.parse(updated.content),
      };
    }),

  // ==========================================
  // CONTENT HISTORY
  // ==========================================

  /**
   * Get version history for a section
   */
  getContentHistory: adminProcedure
    .input(z.object({ sectionType: sectionTypeSchema }))
    .query(async ({ input }) => {
      const repo = container.getSiteConfigRepository();
      const history = await repo.getContentHistory(input.sectionType);
      return history.map((h) => ({
        ...h.toObject(),
        content: JSON.parse(h.content),
      }));
    }),

  /**
   * Revert to a previous version
   */
  revertToVersion: adminProcedure
    .input(
      z.object({
        sectionType: sectionTypeSchema,
        version: z.number().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const repo = container.getSiteConfigRepository();
      const reverted = await repo.revertToVersion(
        input.sectionType,
        input.version,
        ctx.user.id
      );
      return {
        ...reverted.toObject(),
        content: JSON.parse(reverted.content),
      };
    }),

  // ==========================================
  // FEATURED ITEMS
  // ==========================================

  /**
   * Get featured items for a section
   */
  getFeaturedItems: adminProcedure
    .input(z.object({ section: z.string() }))
    .query(async ({ input }) => {
      const repo = container.getSiteConfigRepository();
      const items = await repo.getFeaturedItems(input.section);
      return items.map((i) => i.toObject());
    }),

  /**
   * Update featured items for a section (replaces all)
   */
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

  /**
   * Add a single featured item
   */
  addFeaturedItem: adminProcedure
    .input(featuredItemSchema)
    .mutation(async ({ input }) => {
      const repo = container.getSiteConfigRepository();
      const added = await repo.addFeaturedItem(input);
      return added.toObject();
    }),

  /**
   * Remove a featured item
   */
  removeFeaturedItem: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const repo = container.getSiteConfigRepository();
      await repo.removeFeaturedItem(input.id);
      return { success: true };
    }),

  /**
   * Reorder featured items
   */
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
});
