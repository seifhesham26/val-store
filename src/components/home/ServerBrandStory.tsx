/**
 * Server-side Brand Story section.
 *
 * Reads the `brand_story` CMS section on the server and hands it to the
 * presentational `BrandStory`. Same shape as `ServerHeroSection`: a cached
 * fetch, a try/catch, and hardcoded defaults underneath — so a database
 * failure degrades the section rather than taking the homepage down with it.
 */

import { BrandStory } from "./BrandStory";
import { getCachedBrandStorySection } from "@/lib/cache";

export async function ServerBrandStory() {
  try {
    const section = await getCachedBrandStorySection();

    // `getCachedBrandStorySection` validates against `brandStoryContentSchema`
    // before returning, so an invalid row already came back as `null` and no
    // cast is needed here.
    if (section?.isActive) {
      const content = section.parsedContent;

      return (
        <BrandStory
          preHeadline={content.preHeadline}
          headline={content.headline}
          // Only override the component's own copy when the CMS actually has
          // some. The schema drops blank entries, so an empty array means "no
          // body copy was set" — passing it through would render a headline
          // with nothing under it.
          paragraphs={
            content.paragraphs.length > 0 ? content.paragraphs : undefined
          }
          ctaText={content.ctaText}
          ctaLink={content.ctaLink}
          backgroundImage={content.backgroundImage}
        />
      );
    }
  } catch (error) {
    console.error("[ServerBrandStory] Failed to fetch brand story:", error);
    // Falls through to the unconfigured render below.
  }

  // No row, inactive, or unreadable: the component's own defaults, which
  // include the brand gradient in place of art.
  return <BrandStory />;
}
