import { z } from "zod";
import { adminProcedure } from "../../../trpc";
import { container } from "@/application/container";
import { revalidateTag } from "next/cache";
import {
  heroContentSchema,
  announcementContentSchema,
} from "@/domain/site/value-objects/content-schemas";

// ============================================
// VALIDATION SCHEMAS
//
// `promo_banner`, `brand_story`, `newsletter` and `instagram` were removed
// (ISSUES.md #29) — their components never read this content back, so the
// schemas were decorative. Only the two section types wired end to end
// remain.
// ============================================

export const sectionTypeSchema = z.enum(["hero", "announcement"]);

export const updateContentSectionSchema = z.object({
  sectionType: sectionTypeSchema,
  content: z.union([heroContentSchema, announcementContentSchema]),
  displayOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// PROCEDURES
// ============================================

export const contentSectionsProcedures = {
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

  getAllContentSections: adminProcedure.query(async () => {
    const repo = container.getSiteConfigRepository();
    const sections = await repo.getAllContentSections();
    return sections.map((s) => ({
      ...s.toObject(),
      content: JSON.parse(s.content),
    }));
  }),

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

      revalidateTag(`cms-${input.sectionType}`, "max");
      revalidateTag("cms-sections", "max");

      return {
        ...updated.toObject(),
        content: JSON.parse(updated.content),
      };
    }),

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

      // Same pair `updateContentSection` invalidates — a revert is a write
      // like any other, and skipping this would leave it the one CMS write
      // that doesn't announce itself.
      revalidateTag(`cms-${input.sectionType}`, "max");
      revalidateTag("cms-sections", "max");

      return {
        ...reverted.toObject(),
        content: JSON.parse(reverted.content),
      };
    }),
};
