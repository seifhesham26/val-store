import { describe, expect, it } from "vitest";
import {
  brandStoryContentSchema,
  contentSchemaMap,
  promoBannerContentSchema,
  safeParseSectionContent,
} from "./content-schemas";

/**
 * `brand_story` and `promo_banner` are CMS-driven as of this change. Both had
 * schemas here once, were deleted as dead weight because nothing read them
 * back, and are now real: `ServerBrandStory` and `ServerPromoBanner` render
 * from them.
 *
 * The property worth protecting is that a bad row degrades rather than
 * renders. Both sections fall back to hardcoded copy when parsing fails, so a
 * schema that quietly accepts a `javascript:` CTA or an empty headline would
 * put that straight on the homepage.
 */
describe("brandStoryContentSchema", () => {
  const valid = {
    preHeadline: "Our Story",
    headline: "Crafted for the Bold",
    paragraphs: ["First paragraph.", "Second paragraph."],
    ctaText: "Learn More",
    ctaLink: "/about",
    backgroundImage: "/brand/brand-story.jpg",
  };

  it("accepts a fully specified section", () => {
    expect(brandStoryContentSchema.parse(valid)).toMatchObject(valid);
  });

  it("fills in defaults for everything except the headline", () => {
    const parsed = brandStoryContentSchema.parse({ headline: "Only this" });

    expect(parsed.preHeadline).toBe("Our Story");
    expect(parsed.ctaText).toBe("Learn More");
    expect(parsed.ctaLink).toBe("/about");
    expect(parsed.paragraphs).toEqual([]);
  });

  it("requires a non-empty headline", () => {
    // The headline is the one field with no sensible default — a section
    // rendering a blank <h2> is worse than falling back to the hardcoded copy.
    expect(brandStoryContentSchema.safeParse({ headline: "" }).success).toBe(
      false
    );
    expect(brandStoryContentSchema.safeParse({}).success).toBe(false);
  });

  it("treats the image as optional", () => {
    // Absent is legitimate: both sections keep their brand gradient as the
    // no-image state, so an unset image must parse rather than fail.
    const parsed = brandStoryContentSchema.parse({ headline: "No art yet" });

    expect(parsed.backgroundImage).toBeUndefined();
  });

  it("rejects a javascript: CTA link", () => {
    // This lands in an `href` on the homepage. `urlOrAssetPath` is the guard.
    expect(
      brandStoryContentSchema.safeParse({
        ...valid,
        ctaLink: "javascript:alert(1)",
      }).success
    ).toBe(false);
  });

  it("rejects a javascript: image source", () => {
    expect(
      brandStoryContentSchema.safeParse({
        ...valid,
        backgroundImage: "javascript:alert(1)",
      }).success
    ).toBe(false);
  });

  it("drops empty paragraphs rather than rendering blank <p> tags", () => {
    const parsed = brandStoryContentSchema.parse({
      ...valid,
      paragraphs: ["Real copy.", "", "   ", "More copy."],
    });

    expect(parsed.paragraphs).toEqual(["Real copy.", "More copy."]);
  });
});

describe("promoBannerContentSchema", () => {
  const valid = {
    preHeadline: "Limited Time",
    headline: "Sale",
    description: "Selected styles at reduced prices, while stocks last.",
    ctaText: "Shop Sale",
    ctaLink: "/collections/sale",
    backgroundImage: "/brand/promo.jpg",
  };

  it("accepts a fully specified section", () => {
    expect(promoBannerContentSchema.parse(valid)).toMatchObject(valid);
  });

  it("fills in defaults for everything except the headline", () => {
    const parsed = promoBannerContentSchema.parse({ headline: "Only this" });

    expect(parsed.preHeadline).toBe("Limited Time");
    expect(parsed.ctaText).toBe("Shop Sale");
    expect(parsed.ctaLink).toBe("/collections/sale");
    expect(parsed.description).toBe("");
  });

  it("requires a non-empty headline", () => {
    expect(promoBannerContentSchema.safeParse({ headline: "" }).success).toBe(
      false
    );
  });

  it("rejects a javascript: CTA link", () => {
    expect(
      promoBannerContentSchema.safeParse({
        ...valid,
        ctaLink: "javascript:alert(1)",
      }).success
    ).toBe(false);
  });

  it("accepts an absolute https image, for an uploaded asset", () => {
    // Admin uploads land on a CDN host, not under `/public`.
    const parsed = promoBannerContentSchema.parse({
      ...valid,
      backgroundImage: "https://utfs.io/f/abc123.jpg",
    });

    expect(parsed.backgroundImage).toBe("https://utfs.io/f/abc123.jpg");
  });
});

describe("contentSchemaMap", () => {
  it("exposes exactly the section types that have a consumer", () => {
    // CLAUDE.md's rule: a section type in this map must render somewhere.
    // `newsletter` and `instagram` are deliberately absent — their components
    // are still hardcoded, so listing them here would be the same dead weight
    // that got the original four deleted.
    expect(Object.keys(contentSchemaMap).sort()).toEqual([
      "announcement",
      "brand_story",
      "hero",
      "promo_banner",
    ]);
  });

  it("routes safeParseSectionContent to the right schema", () => {
    // A promo banner's payload must not validate as a brand story: the two
    // differ only by `description` vs `paragraphs`, which is exactly the kind
    // of near-miss a shared union would wave through.
    expect(
      safeParseSectionContent("promo_banner", {
        headline: "Sale",
        description: "Copy",
      }).success
    ).toBe(true);

    expect(
      safeParseSectionContent("brand_story", {
        headline: "Story",
        paragraphs: "not an array",
      }).success
    ).toBe(false);
  });
});
