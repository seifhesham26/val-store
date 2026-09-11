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
  QuickAddBar,
  type QuickAddVariant,
} from "@/components/products/QuickAddBar";
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
    /*
     * No frame.
     *
     * This was a bordered box wrapping image *and* text, which produced two
     * problems at once: the info block had no horizontal padding, so the name
     * sat flush against the left border, and the border drew a hard rectangle
     * around a photograph that already has its own edges. Card chrome reads as
     * cheap on a black page — the photograph is the card.
     *
     * The lift on hover is the only affordance kept, and it moves the whole
     * unit rather than outlining it.
     */
    <div
      className="group relative transition-transform duration-300 ease-out hover:-translate-y-1"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/*
       * The positioned ancestor for everything that overlays the photograph.
       *
       * This matters more than it looks: the Quick Add bar is `absolute
       * bottom-0`, and it used to resolve against the card root — which
       * contained the info block too, so on hover it slid up over the product
       * name and price instead of sitting on the bottom edge of the photo.
       * Anchoring it here is what fixes that.
       */}
      <div className="relative aspect-3/4 overflow-hidden bg-val-steel">
        <Link href={`/products/${slug}`} className="absolute inset-0 block">
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
        </Link>

        {/*
         * Badges and overlays are siblings of the link rather than children of
         * it, so the anchor stays a plain rectangle with nothing interactive
         * nested inside it. `pointer-events-none` on the badges keeps them from
         * punching a hole in the link they sit on top of.
         */}
        <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-col gap-1.5">
          {isNew && (
            <Badge className="rounded-none bg-white px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] text-black uppercase">
              New
            </Badge>
          )}
          {isOnSale && (
            <Badge
              variant="destructive"
              className="rounded-none px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] uppercase"
            >
              Sale
            </Badge>
          )}
        </div>

        <div className="absolute top-3 right-3 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-within:opacity-100">
          <WishlistButton
            productId={id}
            className="bg-black/50 text-white hover:bg-val-accent hover:text-black"
          />
        </div>

        {/* Quick Add — outside the link to avoid nested interactive elements,
            and inside the image box so it lands on the photo's bottom edge. */}
        <div className="absolute inset-x-0 bottom-0 z-10 translate-y-2 bg-linear-to-t from-black/95 via-black/70 to-transparent p-3 pt-12 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100">
          <QuickAddBar
            productId={id}
            productName={name}
            productImage={primaryImage}
            productPrice={salePrice ?? price}
            variants={variants}
          />
        </div>
      </div>

      {/*
       * Set in small caps with wide tracking, which is what carries the
       * editorial register now that the frame is gone. `truncate` keeps every
       * card exactly one line tall so the grid rows stay aligned.
       */}
      <div className="mt-4">
        <Link href={`/products/${slug}`}>
          <h3 className="truncate text-[11px] font-medium tracking-[0.14em] text-white uppercase transition-colors hover:text-val-accent-light">
            {name}
          </h3>
        </Link>
        <div className="mt-1.5 flex items-baseline gap-2">
          {salePrice ? (
            <>
              <span className="text-[13px] text-white">
                {formattedSalePrice}
              </span>
              <span className="text-[11px] text-white/40 line-through">
                {formattedPrice}
              </span>
            </>
          ) : (
            <span className="text-[13px] text-white/60">{formattedPrice}</span>
          )}
        </div>
      </div>
    </div>
  );
}
