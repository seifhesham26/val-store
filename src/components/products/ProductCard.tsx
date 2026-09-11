"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/shared/ProductImage";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import {
  CAROUSEL_EASING,
  CAROUSEL_INTERVAL_MS,
  CAROUSEL_SLIDE_MS,
  SNAP_RESET_MS,
  nextCarouselStep,
  shouldAnimateCard,
  staggerDelayMs,
  trackOffsetPercent,
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
   * Second photo, slid in from the right. Typically the same garment on
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

  /** Which panel of the three-panel track is showing. */
  const [panel, setPanel] = useState(0);
  /**
   * Transitions off for exactly one frame, for the snap from the duplicated
   * third panel back to the first. Both hold the same photograph, so with the
   * transition suppressed the reset cannot be seen.
   */
  const [snapping, setSnapping] = useState(false);
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

    // Staggered start, then a steady interval. Every timer is cleaned up
    // together — a card unmounting mid-stagger would otherwise leave one
    // holding a setter for a component that no longer exists.
    let interval: ReturnType<typeof setInterval> | undefined;
    let snapBack: ReturnType<typeof setTimeout> | undefined;
    let snapClear: ReturnType<typeof setTimeout> | undefined;

    const advance = () => {
      setPanel((current) => {
        const step = nextCarouselStep(current);

        if (step.wrapAfter) {
          // Let the slide onto the duplicated panel finish, then jump home
          // with transitions suppressed. Doing it on the next tick instead
          // would hold the primary photo for two intervals.
          snapBack = setTimeout(() => {
            setSnapping(true);
            setPanel(0);
            // Re-enable on a timer rather than requestAnimationFrame. rAF does
            // not run in a backgrounded tab, and a card that wrapped while the
            // tab was hidden would come back with transitions permanently off
            // — jumping between photographs instead of sliding. The gap is
            // imperceptible because both panels hold the same image.
            snapClear = setTimeout(() => setSnapping(false), SNAP_RESET_MS);
          }, CAROUSEL_SLIDE_MS);
        }

        return step.panel;
      });
    };

    const start = setTimeout(() => {
      advance();
      interval = setInterval(advance, CAROUSEL_INTERVAL_MS);
    }, staggerDelayMs(index));

    return () => {
      clearTimeout(start);
      if (snapBack) clearTimeout(snapBack);
      if (snapClear) clearTimeout(snapClear);
      if (interval) clearInterval(interval);
    };
  }, [animate, index]);

  return (
    <div
      className="group relative border border-white/10 transition-[transform,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-white/25"
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
            /*
             * A sliding track rather than a crossfade.
             *
             * Three panels — primary, secondary, primary — at three times the
             * card's width, translated one panel per step. The repeated third
             * panel is what lets the travel always run the same way: on
             * reaching it the track snaps home with transitions off, and since
             * both panels hold the same photograph the snap is invisible. Two
             * panels would have to slide back the way they came, which reads as
             * a correction rather than a carousel.
             */
            <div
              className="absolute inset-0 flex w-[300%]"
              style={{
                transform: `translate3d(${trackOffsetPercent(panel)}%, 0, 0)`,
                transition: snapping
                  ? "none"
                  : `transform ${CAROUSEL_SLIDE_MS}ms ${CAROUSEL_EASING}`,
                willChange: "transform",
              }}
            >
              <div className="relative h-full w-1/3 shrink-0">
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
                <div aria-hidden className="relative h-full w-1/3 shrink-0">
                  <ProductImage
                    src={secondaryImage}
                    alt=""
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="transition-transform duration-300 group-hover:scale-105"
                    onLoad={() => setSecondLoaded(true)}
                  />
                </div>
              )}

              {/* The repeat that makes the loop one-directional. */}
              {secondaryImage && (
                <div aria-hidden className="relative h-full w-1/3 shrink-0">
                  <ProductImage
                    src={primaryImage}
                    alt=""
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              )}
            </div>
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
