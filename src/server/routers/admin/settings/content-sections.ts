import { z } from "zod";
import { adminProcedure, adminWriteProcedure } from "../../../trpc";
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

type SectionType = z.infer<typeof sectionTypeSchema>;

const contentSchemaBySectionType = {
  hero: heroContentSchema,
  announcement: announcementContentSchema,
} as const;

/**
 * Read `content_sections.content` back as a validated shape, or `null`.
 *
 * Every read here used to be a bare `JSON.parse`, whose result is `any` —
 * the write path validated against these schemas and the read path trusted
 * whatever was in the column. `src/lib/cms-content-parser.ts` was introduced
 * to close exactly that hole, but it was only ever wired into the storefront
 * reads in `src/lib/cache.ts`; the five admin reads below kept parsing blind.
 *
 * That matters most for `revertToVersion` and `getContentHistory`, which
 * surface historical rows verbatim: a version written before a schema change
 * (or by hand, or by a migration) reaches the editor with a shape nothing
 * checked, and `HomepageSettings` calling `.map()` on a `messages` field that
 * is missing or is not an array throws inside a `useEffect` and takes the
 * settings page down.
 *
 * Degrading to `null` rather than throwing is deliberate, and differs from
 * the storefront's reason for the same choice. The storefront falls back to
 * hardcoded defaults so a customer still sees a page. The admin needs the
 * opposite: the editor must still *load* for the one person who can repair
 * the row. `null` leaves the form on its empty defaults, which the admin can
 * fill in and save — a valid row overwrites the invalid one.
 */
function parseSectionContent(sectionType: SectionType, raw: string) {
  try {
    return contentSchemaBySectionType[sectionType].parse(JSON.parse(raw));
  } catch (error) {
    console.error(
      `[cms-content] Invalid ${sectionType} content read by admin:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

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
        content: parseSectionContent(input.sectionType, section.content),
      };
    }),

  // `getAllContentSections` was deleted (ISSUES.md #28) — it had no caller.
  // The admin edits one section at a time through `getContentSection`, and the
  // storefront reads through the cached fetchers in `src/lib/cache.ts`, so
  // nothing ever wanted every section at once. The repository method went with
  // it; `getActiveContentSections` is the one that is actually used.

  updateContentSection: adminWriteProcedure
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
        content: parseSectionContent(input.sectionType, updated.content),
      };
    }),

  toggleSectionStatus: adminWriteProcedure
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
        content: parseSectionContent(input.sectionType, updated.content),
      };
    }),

  getContentHistory: adminProcedure
    .input(z.object({ sectionType: sectionTypeSchema }))
    .query(async ({ input }) => {
      const repo = container.getSiteConfigRepository();
      const history = await repo.getContentHistory(input.sectionType);
      return history.map((h) => ({
        ...h.toObject(),
        content: parseSectionContent(input.sectionType, h.content),
      }));
    }),

  revertToVersion: adminWriteProcedure
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
        content: parseSectionContent(input.sectionType, reverted.content),
      };
    }),
};
