import { describe, expect, it } from "vitest";
import { CMS_SECTIONS_TAG, cmsSectionTag } from "./cms-cache-tags";
import { contentSchemaMap } from "@/domain/site/value-objects/content-schemas";

/**
 * These tags are only useful if the read side and the write side agree on the
 * string, and for two of the four section types they did not: the hero was
 * cached under `hero-section` and the announcement under `announcement`, while
 * `content-sections.ts` invalidated `cms-hero` and `cms-announcement`. Saving
 * either in the admin invalidated nothing, and the change appeared whenever
 * the 60-second TTL happened to expire.
 *
 * Nothing failed, nothing logged, and the storefront was right again a minute
 * later — which is why it survived. The fix is that both sides now call
 * `cmsSectionTag`, so the string exists once.
 */
describe("cmsSectionTag", () => {
  it("builds the tag the write path invalidates", () => {
    expect(cmsSectionTag("hero")).toBe("cms-hero");
    expect(cmsSectionTag("announcement")).toBe("cms-announcement");
    expect(cmsSectionTag("brand_story")).toBe("cms-brand_story");
    expect(cmsSectionTag("promo_banner")).toBe("cms-promo_banner");
  });

  it("covers every section type the CMS knows about", () => {
    // A new section type gets a tag for free rather than needing one invented,
    // which is the specific mistake that produced `hero-section`.
    for (const sectionType of Object.keys(contentSchemaMap)) {
      expect(cmsSectionTag(sectionType as never)).toBe(`cms-${sectionType}`);
    }
  });

  it("gives every section type a distinct tag", () => {
    const tags = Object.keys(contentSchemaMap).map((sectionType) =>
      cmsSectionTag(sectionType as never)
    );

    expect(new Set(tags).size).toBe(tags.length);
  });

  it("keeps the all-sections tag out of the per-section namespace", () => {
    // `cms-sections` must not collide with `cmsSectionTag("sections")` for a
    // hypothetical section type named "sections".
    expect(CMS_SECTIONS_TAG).toBe("cms-sections");
    expect(Object.keys(contentSchemaMap)).not.toContain("sections");
  });
});
