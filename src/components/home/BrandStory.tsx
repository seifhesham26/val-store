import Link from "next/link";
import { Button } from "@/components/ui/button";

interface BrandStoryProps {
  preHeadline?: string;
  headline?: string;
  paragraphs?: string[];
  ctaText?: string;
  ctaLink?: string;
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
}: BrandStoryProps) {
  return (
    <section className="py-16 md:py-24 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-8 md:gap-16 items-center">
          {/* Image Side */}
          <div className="relative aspect-4/5 overflow-hidden">
            {/*
             * A brand gradient, not a stock photo. This was a random picsum
             * image, which reads as real photography of clothes the store does
             * not sell — worse than showing nothing. Replace with a real
             * studio shot; see docs/IMAGE-PROMPTS.md for a prompt that matches
             * the rest of the site.
             */}
            <div className="absolute inset-0 bg-linear-to-br from-gray-800 via-gray-900 to-black" />
            {/* Decorative accent line */}
            <div className="absolute bottom-0 left-0 w-1/2 h-1 bg-val-accent" />
          </div>

          {/* Content Side */}
          <div className="py-8 md:py-0">
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
            <Link href={ctaLink} className="inline-block mt-8">
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
