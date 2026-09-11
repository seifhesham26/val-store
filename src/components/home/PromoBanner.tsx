import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { unoptimizedFor } from "@/lib/image-hosts";
import { safeHref } from "@/lib/safe-url";

interface PromoBannerProps {
  preHeadline?: string;
  headline?: string;
  description?: string;
  ctaText?: string;
  ctaLink?: string;
  /** Absent renders the brand gradient — see `BrandStory` for why. */
  backgroundImage?: string;
}

export function PromoBanner({
  preHeadline = "Limited Time",
  headline = "Sale",
  description = "Selected styles at reduced prices, while stocks last.",
  ctaText = "Shop Sale",
  ctaLink = "/collections/sale",
  backgroundImage,
}: PromoBannerProps) {
  const href = safeHref(ctaLink) ?? "/collections/sale";

  return (
    <section className="bg-val-steel">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2">
        {/* Image Side */}
        <div
          className="val-reveal relative aspect-square md:aspect-auto md:min-h-[400px]"
          data-reveal
        >
          {backgroundImage ? (
            <Image
              src={backgroundImage}
              alt=""
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
              unoptimized={unoptimizedFor(backgroundImage)}
            />
          ) : (
            /* Brand gradient until real promo art exists — see BrandStory. */
            <div className="absolute inset-0 bg-linear-to-br from-gray-800 via-gray-900 to-black" />
          )}
          {/*
           * Kept over the image, not just the gradient. The banner's headline
           * and body sit beside this on desktop but *over* it on mobile, where
           * the grid collapses to one column — so the copy needs the contrast
           * either way.
           */}
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Content Side */}
        <div
          className="val-reveal flex flex-col justify-center p-8 md:p-12 lg:p-16"
          data-reveal
        >
          <span className="text-val-accent text-sm uppercase tracking-wider font-medium">
            {preHeadline}
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mt-2">
            {headline}
          </h2>
          <p className="text-gray-400 mt-4 max-w-md">{description}</p>
          <Link href={href} className="mt-6 w-fit">
            <Button className="bg-white text-black hover:bg-val-silver px-6 py-3">
              {ctaText}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
