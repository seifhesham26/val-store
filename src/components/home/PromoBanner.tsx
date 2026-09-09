import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PromoBannerProps {
  preHeadline?: string;
  headline?: string;
  description?: string;
  ctaText?: string;
  ctaLink?: string;
}

export function PromoBanner({
  preHeadline = "Limited Time",
  headline = "Sale",
  description = "Selected styles at reduced prices, while stocks last.",
  ctaText = "Shop Sale",
  ctaLink = "/collections/sale",
}: PromoBannerProps) {
  return (
    <section className="bg-val-steel">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2">
        {/* Image Side */}
        <div className="relative aspect-square md:aspect-auto md:min-h-[400px]">
          {/* Brand gradient until real promo art exists — see BrandStory. */}
          <div className="absolute inset-0 bg-linear-to-br from-gray-800 via-gray-900 to-black" />
          {/* Subtle overlay */}
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Content Side */}
        <div className="flex flex-col justify-center p-8 md:p-12 lg:p-16">
          <span className="text-val-accent text-sm uppercase tracking-wider font-medium">
            {preHeadline}
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mt-2">
            {headline}
          </h2>
          <p className="text-gray-400 mt-4 max-w-md">{description}</p>
          <Link href={ctaLink} className="mt-6 w-fit">
            <Button className="bg-white text-black hover:bg-val-silver px-6 py-3">
              {ctaText}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
