"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/shared/ProductImage";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import {
  CAROUSEL_FADE_MS,
  CAROUSEL_INTERVAL_MS,
  shouldAnimateCard,
  staggerDelayMs,
} from "@/lib/card-carousel";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import {
  QuickAddSliderBar,
  type QuickAddVariant,
} from "@/components/products/QuickAddSliderBar";
import { formatCurrency } from "@/lib/currency";

export interface ProductCardProps {
  id: string;
  name: string;
  slug: string;
  price: number;
  salePrice?: number;
  primaryImage?: string;
  /**
   * Second photo, crossfaded with the first. Typically the same garment on
   * another model — the range is mostly unisex, so this shows fit rather than
   * just filling space. Absent means the card never moves.
   */
  secondaryImage?: string;
  /**
   * Position in the grid, used only to stagger this card's start. Without it
   * every card flips on the same tick and the page pulses in unison, which
   * reads as a rendering fault rather than as motion.
   */
  index?: number;
  isNew?: boolean;
  isOnSale?: boolean;
  isFeatured?: boolean;
  /**
   * Render this image eagerly at high priority. Set on the first row of a grid
   * only — one of those cards is the page's LCP element, and lazy-loading it
   * costs a round trip after hydration before the customer sees anything.
   */
  priority?: boolean;
  /**
   * Required on purpose. A card rendered without its variants falls back to a
   * plain "Quick Add" that adds no variant, which silently skips stock
   * tracking at checkout. Making this mandatory turns that omission into a
   * compile error — pass [] only when the product genuinely has no variants.
   */
  variants: QuickAddVariant[];
}

export function ProductCard({
  id,
  name,
  slug,
  price,
  salePrice,
  primaryImage,
  secondaryImage,
  index = 0,
  isNew = false,
  isOnSale = false,
  priority = false,
  variants,
}: ProductCardProps) {
  const formattedPrice = formatCurrency(price);
  const formattedSalePrice =
    salePrice !== null && salePrice !== undefined
      ? formatCurrency(salePrice)
      : undefined;

  const [showSecond, setShowSecond] = useState(false);
  const [secondLoaded, setSecondLoaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const animate =
    shouldAnimateCard({
      hasSecondImage: Boolean(secondaryImage),
      secondImageLoaded: secondLoaded,
      reducedMotion,
    }) && !paused;

  useEffect(() => {
    if (!animate) return;

    // Staggered start, then a steady interval. Both are cleaned up together —
    // a card unmounting mid-stagger would otherwise leave a timer holding a
    // setter for a component that no longer exists.
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      setShowSecond((s) => !s);
      interval = setInterval(
        () => setShowSecond((s) => !s),
        CAROUSEL_INTERVAL_MS
      );
    }, staggerDelayMs(index));

    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [animate, index]);

  return (
    <div
      className="group relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Image Container — wrapped in a link */}
      <Link href={`/products/${slug}`} className="block">
        <div className="relative aspect-3/4 overflow-hidden bg-val-steel">
          {/* Product Image or gradient fallback */}
          {primaryImage ? (
            <>
              <div
                className="absolute inset-0 transition-opacity"
                style={{
                  transitionDuration: `${CAROUSEL_FADE_MS}ms`,
                  opacity: showSecond ? 0 : 1,
                }}
              >
                <ProductImage
                  src={primaryImage}
                  alt={name}
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  priority={priority}
                  className="transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              {/*
               * The second shot — the same garment on another model. Loaded
               * lazily and never given `priority`: it must not compete with the
               * LCP image for bandwidth, and until it has decoded the card
               * simply does not animate.
               */}
              {secondaryImage && (
                <div
                  aria-hidden
                  className="absolute inset-0 transition-opacity"
                  style={{
                    transitionDuration: `${CAROUSEL_FADE_MS}ms`,
                    opacity: showSecond ? 1 : 0,
                  }}
                >
                  <ProductImage
                    src={secondaryImage}
                    alt=""
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="transition-transform duration-300 group-hover:scale-105"
                    onLoad={() => setSecondLoaded(true)}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-gray-700 via-gray-800 to-gray-900" />
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
            {isNew && (
              <Badge className="bg-val-accent text-white text-xs px-2 py-0.5">
                New
              </Badge>
            )}
            {isOnSale && (
              <Badge variant="destructive" className="text-xs px-2 py-0.5">
                Sale
              </Badge>
            )}
          </div>

          {/* Wishlist Button */}
          <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300">
            <WishlistButton
              productId={id}
              className="bg-black/50 hover:bg-val-accent text-white"
            />
          </div>
        </div>
      </Link>

      {/* Quick Add Slider — outside the link to avoid nested interactive elements */}
      <div className="absolute bottom-0 inset-x-0 p-2 pt-8 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-10 bg-linear-to-t from-black/90 via-black/60 to-transparent">
        <QuickAddSliderBar
          productId={id}
          productName={name}
          productImage={primaryImage}
          productPrice={salePrice ?? price}
          variants={variants}
        />
      </div>

      {/* Product Info */}
      <div className="mt-3">
        <Link href={`/products/${slug}`}>
          <h3 className="text-sm font-medium text-white truncate hover:text-val-accent transition-colors">
            {name}
          </h3>
        </Link>
        <div className="flex items-center gap-2 mt-1">
          {salePrice ? (
            <>
              <span className="text-red-400 font-medium">
                {formattedSalePrice}
              </span>
              <span className="text-gray-500 line-through text-sm">
                {formattedPrice}
              </span>
            </>
          ) : (
            <span className="text-gray-300">{formattedPrice}</span>
          )}
        </div>
      </div>
    </div>
  );
}
