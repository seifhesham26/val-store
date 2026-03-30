/**
 * Content Section Zod Schemas
 *
 * Type-safe validation for JSON content in content_sections table.
 */

import { z } from "zod";

// ============================================
// HERO SECTION
// ============================================

export const heroContentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().optional().default(""),
  backgroundImage: z.string().url("Must be a valid URL").optional(),
  backgroundVideo: z.string().url("Must be a valid URL").optional(),
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
// PROMO BANNER
// ============================================

export const promoBannerContentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subtitle: z.string().optional().default(""),
  description: z.string().optional().default(""),
  image: z.string().url("Must be a valid URL").optional(),
  imagePosition: z.enum(["left", "right"]).optional().default("right"),
  ctaText: z.string().optional().default("Shop Now"),
  ctaLink: z.string().optional().default("/collections/sale"),
  backgroundColor: z.string().optional().default("#1f1f1f"),
  accentColor: z.string().optional().default("#a855f7"),
});

export type PromoBannerContent = z.infer<typeof promoBannerContentSchema>;

// ============================================
// BRAND STORY
// ============================================

export const brandStoryContentSchema = z.object({
  preheading: z.string().optional().default("Our Story"),
  title: z.string().min(1, "Title is required"),
  paragraphs: z.array(z.string()).min(1, "At least one paragraph required"),
  image: z.string().url("Must be a valid URL").optional(),
  imagePosition: z.enum(["left", "right"]).optional().default("left"),
  ctaText: z.string().optional().default("Learn More"),
  ctaLink: z.string().optional().default("/about"),
});

export type BrandStoryContent = z.infer<typeof brandStoryContentSchema>;

// ============================================
// NEWSLETTER
// ============================================

export const newsletterContentSchema = z.object({
  title: z.string().optional().default("Join the Valkyrie Community"),
  subtitle: z
    .string()
    .optional()
    .default("Subscribe for exclusive offers and updates"),
  incentive: z.string().optional().default("Get 10% off your first order"),
  buttonText: z.string().optional().default("Subscribe"),
  backgroundColor: z.string().optional(),
  privacyText: z
    .string()
    .optional()
    .default("By subscribing, you agree to our Privacy Policy."),
});

export type NewsletterContent = z.infer<typeof newsletterContentSchema>;

// ============================================
// INSTAGRAM FEED
// ============================================

export const instagramContentSchema = z.object({
  handle: z.string().optional().default("@valkyrie"),
  profileUrl: z.string().url("Must be a valid URL").optional(),
  images: z.array(z.string().url()).optional().default([]),
});

export type InstagramContent = z.infer<typeof instagramContentSchema>;

// ============================================
// SECTION TYPE MAPPING
// ============================================

export const contentSchemaMap = {
  hero: heroContentSchema,
  announcement: announcementContentSchema,
  promo_banner: promoBannerContentSchema,
  brand_story: brandStoryContentSchema,
  newsletter: newsletterContentSchema,
  instagram: instagramContentSchema,
} as const;

export type SectionTypeKey = keyof typeof contentSchemaMap;

/**
 * Validate content for a given section type
 * Returns the parsed and validated content
 */
export function validateSectionContent(
  sectionType: SectionTypeKey,
  content: unknown
):
  | HeroContent
  | AnnouncementContent
  | PromoBannerContent
  | BrandStoryContent
  | NewsletterContent
  | InstagramContent {
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

export function parsePromoBannerContent(content: unknown): PromoBannerContent {
  return promoBannerContentSchema.parse(content);
}

export function parseBrandStoryContent(content: unknown): BrandStoryContent {
  return brandStoryContentSchema.parse(content);
}

export function parseNewsletterContent(content: unknown): NewsletterContent {
  return newsletterContentSchema.parse(content);
}

export function parseInstagramContent(content: unknown): InstagramContent {
  return instagramContentSchema.parse(content);
}
