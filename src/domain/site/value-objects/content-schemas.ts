/**
 * Content Section Zod Schemas
 *
 * Type-safe validation for JSON content in content_sections table.
 */

import { z } from "zod";
import { urlOrAssetPath } from "@/domain/shared/value-objects/url-or-asset-path.schema";

// ============================================
// HERO SECTION
// ============================================

export const heroContentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().optional().default(""),
  backgroundImage: urlOrAssetPath.optional(),
  backgroundVideo: urlOrAssetPath.optional(),
  overlayOpacity: z.number().min(0).max(100).optional().default(40),
  ctaText: z.string().optional().default("Shop Now"),
  ctaLink: z.string().optional().default("/collections"),
  ctaStyle: z
    .enum(["primary", "outline", "ghost"])
    .optional()
    .default("primary"),
  textAlignment: z
    .enum(["left", "center", "right"])
    .optional()
    .default("center"),
});

export type HeroContent = z.infer<typeof heroContentSchema>;

// ============================================
// ANNOUNCEMENT BAR
// ============================================

export const announcementMessageSchema = z.object({
  text: z.string().min(1, "Message text is required"),
  link: z.string().optional(),
  icon: z.string().optional(),
});

export const announcementContentSchema = z.object({
  messages: z
    .array(announcementMessageSchema)
    .min(1, "At least one message required"),
  rotateInterval: z.number().min(1000).max(30000).optional().default(5000),
  backgroundColor: z.string().optional().default("#1a1a1a"),
  textColor: z.string().optional().default("#ffffff"),
  dismissible: z.boolean().optional().default(true),
});

export type AnnouncementContent = z.infer<typeof announcementContentSchema>;

// ============================================
// SECTION TYPE MAPPING
//
// `promo_banner`, `brand_story`, `newsletter` and `instagram` used to have
// schemas here too, but `PromoBanner`, `BrandStory` and `NewsletterSection`
// have always rendered hardcoded props — nothing ever read these back — and
// there was no Instagram component at all. Deleted rather than left as dead
// weight claiming to drive components they don't (ISSUES.md #29).
// ============================================

export const contentSchemaMap = {
  hero: heroContentSchema,
  announcement: announcementContentSchema,
} as const;

export type SectionTypeKey = keyof typeof contentSchemaMap;

/**
 * Validate content for a given section type
 * Returns the parsed and validated content
 */
export function validateSectionContent(
  sectionType: SectionTypeKey,
  content: unknown
): HeroContent | AnnouncementContent {
  const schema = contentSchemaMap[sectionType];
  return schema.parse(content);
}

/**
 * Safe parse content (returns success/error)
 */
export function safeParseSectionContent(
  sectionType: SectionTypeKey,
  content: unknown
) {
  const schema = contentSchemaMap[sectionType];
  return schema.safeParse(content);
}

/**
 * Type guard helpers for specific section types
 */
export function parseHeroContent(content: unknown): HeroContent {
  return heroContentSchema.parse(content);
}

export function parseAnnouncementContent(
  content: unknown
): AnnouncementContent {
  return announcementContentSchema.parse(content);
}
