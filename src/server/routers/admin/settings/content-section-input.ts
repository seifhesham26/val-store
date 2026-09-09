/**
 * Input validation for the content-section admin endpoints.
 *
 * Split out of `content-sections.ts` so it can be unit tested: that module
 * imports the DI container and therefore a live `@/db`, which the default
 * (database-free) suite cannot load. This file depends only on zod and the
 * domain schemas.
 */

import { z } from "zod";
import {
  heroContentSchema,
  announcementContentSchema,
  brandStoryContentSchema,
  promoBannerContentSchema,
} from "@/domain/site/value-objects/content-schemas";

// ============================================
// VALIDATION SCHEMAS
//
// `newsletter` and `instagram` remain removed (ISSUES.md #29): their
// components still render hardcoded props, so a schema for them would be
// decorative. `brand_story` and `promo_banner` are back because
// `ServerBrandStory` and `ServerPromoBanner` now read them — the condition
// that got all four deleted no longer holds for these two.
//
// This list must stay in step with `contentSchemaMap`; the storefront reads
// through that one, and this one is what the admin is allowed to write.
// ============================================

export const sectionTypeSchema = z.enum([
  "hero",
  "announcement",
  "brand_story",
  "promo_banner",
]);

export type SectionType = z.infer<typeof sectionTypeSchema>;

export const contentSchemaBySectionType = {
  hero: heroContentSchema,
  announcement: announcementContentSchema,
  brand_story: brandStoryContentSchema,
  promo_banner: promoBannerContentSchema,
} as const;

/**
 * The payload `updateContentSection` accepts.
 *
 * A **discriminated** union, not a plain one. This was
 * `z.union([heroContentSchema, announcementContentSchema])`, which never tied
 * `content` to `sectionType` at all — zod simply took the first member that
 * parsed. That was survivable while the two members required different fields
 * (`title` vs `messages`), but it stops being survivable the moment two
 * section types have overlapping shapes.
 *
 * `brand_story` and `promo_banner` are exactly that case: both require only
 * `headline`, and differ by `paragraphs` versus `description`. Since zod
 * objects strip unknown keys, a promo banner sent through a plain union would
 * match the brand-story member first, lose `description` silently, and the
 * handler would persist the stripped object with `JSON.stringify`. The
 * section would then render with no body copy and nothing anywhere would have
 * reported an error.
 *
 * Discriminating on `sectionType` makes the pairing explicit, so content is
 * always validated against the schema for the type it claims to be.
 */
export const updateContentSectionSchema = z.discriminatedUnion("sectionType", [
  z.object({
    sectionType: z.literal("hero"),
    content: heroContentSchema,
    displayOrder: z.number().optional(),
    isActive: z.boolean().optional(),
  }),
  z.object({
    sectionType: z.literal("announcement"),
    content: announcementContentSchema,
    displayOrder: z.number().optional(),
    isActive: z.boolean().optional(),
  }),
  z.object({
    sectionType: z.literal("brand_story"),
    content: brandStoryContentSchema,
    displayOrder: z.number().optional(),
    isActive: z.boolean().optional(),
  }),
  z.object({
    sectionType: z.literal("promo_banner"),
    content: promoBannerContentSchema,
    displayOrder: z.number().optional(),
    isActive: z.boolean().optional(),
  }),
]);

export type UpdateContentSectionInput = z.infer<
  typeof updateContentSectionSchema
>;
