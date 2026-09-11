/**
 * Server-side Promo Banner section.
 *
 * See `ServerBrandStory` — same contract, same fallback behaviour.
 */

import { PromoBanner } from "./PromoBanner";
import { getCachedPromoBannerSection } from "@/lib/cache";
import { RevealRegion } from "@/components/motion/RevealRegion";

export async function ServerPromoBanner() {
  try {
    const section = await getCachedPromoBannerSection();

    if (section?.isActive) {
      const content = section.parsedContent;

      return (
        <RevealRegion>
          <PromoBanner
            preHeadline={content.preHeadline}
            headline={content.headline}
            // Empty string is the schema's default for "not set", and an empty
            // <p> under the headline reads as a layout bug rather than as
            // absence — so fall back to the component's copy instead.
            description={content.description || undefined}
            ctaText={content.ctaText}
            ctaLink={content.ctaLink}
            backgroundImage={content.backgroundImage}
          />
        </RevealRegion>
      );
    }
  } catch (error) {
    console.error("[ServerPromoBanner] Failed to fetch promo banner:", error);
  }

  return (
    <RevealRegion>
      <PromoBanner />
    </RevealRegion>
  );
}
