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
  // Validated, not a bare string: this lands in an `href` on the storefront
  // home page, so an unchecked value here is a `javascript:` URL that runs for
  // every visitor. `urlOrAssetPath` allows the two shapes a CTA legitimately
  // takes — a site path, or an absolute http(s) link to a campaign page — and
  // nothing else. `safeHref` re-checks at render time, because rows written
  // before this existed are still in the database.
  ctaLink: urlOrAssetPath.optional().default("/collections"),
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
  // Same reasoning as `ctaLink` above, and the announcement bar is on *every*
  // storefront page rather than just the home page.
  link: urlOrAssetPath.optional(),
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
// BRAND STORY
// ============================================

/**
 * Blank entries are dropped rather than rejected.
 *
 * The admin editor is a textarea split on blank lines, so a trailing newline
 * or a double gap between paragraphs is normal typing, not a mistake worth
 * refusing a save over. What must not survive is an empty string reaching the
 * component, which would render a blank `<p>` and an unexplained gap.
 */
const paragraphList = z
  .array(z.string())
  .optional()
  .default([])
  .transform((paragraphs) =>
    paragraphs.map((text) => text.trim()).filter((text) => text.length > 0)
  );

export const brandStoryContentSchema = z.object({
  preHeadline: z.string().optional().default("Our Story"),
  // The one field with no sensible default. A section rendering a blank <h2>
  // is worse than one falling back to its hardcoded copy, so failing
  // validation here is the desired outcome.
  headline: z.string().min(1, "Headline is required"),
  paragraphs: paragraphList,
  ctaText: z.string().optional().default("Learn More"),
  // Same reasoning as the hero's `ctaLink`: this lands in an `href` on the
  // storefront home page, so it is validated rather than taken as a string.
  ctaLink: urlOrAssetPath.optional().default("/about"),
  // Optional because the gradient is a legitimate state, not a failure — the
  // section renders it whenever no art has been set.
  backgroundImage: urlOrAssetPath.optional(),
});

export type BrandStoryContent = z.infer<typeof brandStoryContentSchema>;

// ============================================
// PROMO BANNER
// ============================================

export const promoBannerContentSchema = z.object({
  preHeadline: z.string().optional().default("Limited Time"),
  headline: z.string().min(1, "Headline is required"),
  description: z.string().optional().default(""),
  ctaText: z.string().optional().default("Shop Sale"),
  ctaLink: urlOrAssetPath.optional().default("/collections/sale"),
  backgroundImage: urlOrAssetPath.optional(),
});

export type PromoBannerContent = z.infer<typeof promoBannerContentSchema>;

// ============================================
// SECTION TYPE MAPPING
//
// A type belongs here only if something renders it. `promo_banner` and
// `brand_story` were deleted from this map once, correctly, because
// `PromoBanner` and `BrandStory` rendered hardcoded props and nothing ever
// read the rows back (ISSUES.md #29). They are here again because that is no
// longer true: `ServerBrandStory` and `ServerPromoBanner` read them.
//
// `newsletter` and `instagram` stay out. `NewsletterSection` is still
// hardcoded and there has never been an Instagram component, so adding them
// would recreate exactly the dead weight that got the original four removed.
// ============================================

export const contentSchemaMap = {
  hero: heroContentSchema,
  announcement: announcementContentSchema,
  brand_story: brandStoryContentSchema,
  promo_banner: promoBannerContentSchema,
} as const;

export type SectionTypeKey = keyof typeof contentSchemaMap;

/**
 * Validate content for a given section type
 * Returns the parsed and validated content
 */
export function validateSectionContent(
  sectionType: SectionTypeKey,
  content: unknown
): HeroContent | AnnouncementContent | BrandStoryContent | PromoBannerContent {
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

export function parseBrandStoryContent(content: unknown): BrandStoryContent {
  return brandStoryContentSchema.parse(content);
}

export function parsePromoBannerContent(content: unknown): PromoBannerContent {
  return promoBannerContentSchema.parse(content);
}
