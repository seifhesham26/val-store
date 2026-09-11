import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { unoptimizedFor } from "@/lib/image-hosts";
import { safeHref } from "@/lib/safe-url";

interface BrandStoryProps {
  preHeadline?: string;
  headline?: string;
  paragraphs?: string[];
  ctaText?: string;
  ctaLink?: string;
  /**
   * Optional by design. No art is a legitimate state — the section falls back
   * to the brand gradient rather than to a stock photograph of clothes this
   * store does not sell, which is what used to be here.
   */
  backgroundImage?: string;
}

export function BrandStory({
  preHeadline = "Our Story",
  headline = "Crafted for the Bold",
  paragraphs = [
    "Valkyrie was born from a simple idea: fashion should empower. Every piece in our collection is designed for those who refuse to blend in, who see clothing as a form of self-expression.",
    "From sustainable sourcing to ethical manufacturing, we're committed to creating fashion that looks good and does good.",
  ],
  ctaText = "Learn More",
  ctaLink = "/about",
  backgroundImage,
}: BrandStoryProps) {
  // Re-checked at render even though the schema already validated it: rows
  // written before `brandStoryContentSchema` existed are still in the
  // database, and this is the same guard the hero applies to its CTA.
  const href = safeHref(ctaLink) ?? "/about";

  return (
    <section className="py-16 md:py-24 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-8 md:gap-16 items-center">
          {/* Image Side */}
          <div
            className="val-reveal relative aspect-4/5 overflow-hidden"
            data-reveal
          >
            {backgroundImage ? (
              <Image
                src={backgroundImage}
                // Decorative: the headline beside it already carries the
                // meaning, so announcing this again is noise to a screen
                // reader.
                alt=""
                fill
                // Half the grid above `md`, full width below it.
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
                unoptimized={unoptimizedFor(backgroundImage)}
              />
            ) : (
              /*
               * A brand gradient, not a stock photo. This was a random picsum
               * image, which reads as real photography of clothes the store
               * does not sell — worse than showing nothing. Set an image in
               * Admin → Settings → Homepage; docs/IMAGE-PROMPTS.md has a
               * prompt that matches the rest of the site.
               */
              <div className="absolute inset-0 bg-linear-to-br from-gray-800 via-gray-900 to-black" />
            )}
            {/* Decorative accent line */}
            <div className="absolute bottom-0 left-0 w-1/2 h-1 bg-val-accent" />
          </div>

          {/* Content Side */}
          <div className="val-reveal py-8 md:py-0" data-reveal>
            <span className="text-val-accent uppercase tracking-widest text-sm font-medium">
              {preHeadline}
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mt-3">
              {headline}
            </h2>
            {paragraphs.map((text, idx) => (
              <p key={idx} className="text-gray-400 mt-6 leading-relaxed">
                {text}
              </p>
            ))}
            <Link href={href} className="inline-block mt-8">
              <Button
                size="lg"
                className="bg-white text-black hover:bg-val-silver px-8 py-6 text-base font-medium tracking-wide"
              >
                {ctaText}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
