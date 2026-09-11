/**
 * Quick Add Bar
 *
 * The hover overlay on a product card: pick a colour, tap a size, done.
 *
 * ## Why this replaced the odometer wheels
 *
 * It was previously two scroll-snap "wheels" — one for size, one for colour —
 * plus an Add button. Four problems, and they compounded:
 *
 * 1. **It hid the answer.** A wheel shows one option at a time. The single
 *    most useful thing a quick-add can tell you is *which sizes are left*, and
 *    the wheel made you scroll through them one at a time to find out — then
 *    only revealed that a combination was sold out after you pressed Add.
 * 2. **It was enormous.** Label, arrow, a three-slot window, arrow — about
 *    140px tall, over a third of the card, covering the photograph that is
 *    doing the actual selling.
 * 3. **It rendered a picker for a single option.** Most products here have one
 *    colour, and a whole wheel to choose between one thing is absurd.
 * 4. **Scroll-snap inside a hover overlay is fiddly.** The overlay is only
 *    present while hovered, so a mis-scroll dismisses the thing you were
 *    aiming at.
 *
 * Now: every size is visible at once, sold-out ones struck through before you
 * touch them, and the press that picks a size is the press that adds it. The
 * colour row renders only when there is genuinely a choice to make. Total
 * height is roughly a third of what it was.
 */

"use client";

import { useState } from "react";
import { Check, LogIn, ShoppingCart } from "lucide-react";
import { useCart, useCartAddDelta } from "@/components/providers/cart-provider";
import { toast } from "sonner";

import { useVariantStock } from "@/hooks/use-variant-stock";
import { quantityInCart, remainingCapacity } from "@/lib/cart-stock-limit";
import { resolveColorHex } from "@/lib/colors";

export interface QuickAddVariant {
  id: string;
  size: string | null;
  color: string | null;
  inStock: boolean;
}

interface QuickAddBarProps {
  productId: string;
  productName: string;
  productImage?: string | null;
  /**
   * What a guest line should display until the merge replaces it.
   *
   * Display only — the server re-resolves price and stock when a guest cart is
   * merged on sign-in, so a stale figure here can never reach an order.
   */
  productPrice: number;
  variants: QuickAddVariant[];
}

export function QuickAddBar({
  productId,
  productName,
  productImage,
  productPrice,
  variants,
}: QuickAddBarProps) {
  const sizes = Array.from(
    new Set(variants.map((v) => v.size).filter(Boolean) as string[])
  );
  const colors = Array.from(
    new Set(variants.map((v) => v.color).filter(Boolean) as string[])
  );

  const [selectedColor, setSelectedColor] = useState<string | null>(
    colors[0] ?? null
  );
  /**
   * The size whose chip should show the "added" count.
   *
   * `useCartAddDelta` is a hook, so it cannot be called once per size inside a
   * map. Tracking the last size pressed lets one call cover the only chip that
   * needs the badge, and keeps the burst-press counter the old Add button had.
   */
  const [lastAddedSize, setLastAddedSize] = useState<string | null>(null);

  // Shares the same cached stock query as the product page — one fetch per set
  // of variants, refreshed in the background, not one request per add.
  const stock = useVariantStock(variants.map((v) => v.id));
  const { addItem, isAuthenticated, items } = useCart();

  const variantFor = (size: string | null, color: string | null) =>
    variants.find(
      (v) =>
        (size === null || v.size === size) &&
        (color === null || v.color === color)
    );

  /**
   * Resolve every size against the chosen colour up front.
   *
   * This is the substance of the redesign, not decoration: availability is a
   * property of the (size, colour) pair, so it can only be shown once a colour
   * is chosen — and showing it is what stops the customer discovering a
   * sold-out combination by being refused after pressing Add.
   */
  const sizeStates = sizes.map((size) => {
    const variant = variantFor(size, selectedColor);
    const live = stock.get(variant?.id);
    const inStock = live !== null ? live > 0 : (variant?.inStock ?? false);
    const inCart = quantityInCart(items, productId, variant?.id ?? null);

    return {
      size,
      variantId: variant?.id ?? null,
      inStock,
      inCart,
      atCeiling: inStock && remainingCapacity(live, inCart) === 0,
      remaining: remainingCapacity(live, inCart),
    };
  });

  const lastAddedVariantId = lastAddedSize
    ? (variantFor(lastAddedSize, selectedColor)?.id ?? null)
    : null;
  const pendingAdded = useCartAddDelta(productId, lastAddedVariantId);

  /** Add one unit of a specific (size, colour) pair. */
  const add = (
    e: React.MouseEvent,
    state: { size: string | null; variantId: string | null; remaining: number }
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // The chip is disabled at the ceiling; this is the belt to that pair of
    // braces, so "the thirty-first press issues no request" is true at the
    // call site rather than only in the arithmetic.
    if (state.remaining <= 0) return;

    setLastAddedSize(state.size);

    const live = stock.get(state.variantId ?? undefined);

    // Local and immediate. Thirty presses become one additive `cart.add`; a
    // refusal surfaces from the provider as a toast with a Retry action.
    addItem(productId, 1, state.variantId, {
      productName,
      productPrice,
      productImage: productImage ?? null,
      variantLabel:
        [state.size, selectedColor].filter(Boolean).join(" / ") || null,
      // The grid's variant shape carries only a boolean, so when the live
      // cache has no figure yet we allow one unit and let the server resolve
      // the real ceiling.
      maxStock: live ?? 1,
    });

    // No `openCart()` on purpose: with burst pressing, press one would slide
    // the drawer over the card still being pressed. The navbar badge and the
    // chip's own count are the confirmation.
  };

  /** The whole-product add, for a product with no sizes at all. */
  const addWhole = (e: React.MouseEvent) => {
    const variant = variantFor(null, selectedColor);
    const live = stock.get(variant?.id);
    const inStock = live !== null ? live > 0 : (variant?.inStock ?? false);

    if (!inStock) {
      e.preventDefault();
      e.stopPropagation();
      toast.error("This combination is out of stock");
      return;
    }

    const inCart = quantityInCart(items, productId, variant?.id ?? null);
    add(e, {
      size: null,
      variantId: variant?.id ?? null,
      remaining: remainingCapacity(live, inCart),
    });
  };

  const signInHref = `/login?redirect=${encodeURIComponent(
    typeof window !== "undefined" ? window.location.pathname : "/"
  )}`;

  /** One full-width bar, for the sign-in and no-variants cases. */
  const barClass =
    "flex w-full items-center justify-center gap-1.5 rounded-sm py-2 " +
    "text-[10px] font-semibold tracking-[0.12em] uppercase transition-colors";

  if (!isAuthenticated) {
    return (
      <a
        href={signInHref}
        onClick={(e) => e.stopPropagation()}
        className={`${barClass} bg-val-accent text-black hover:bg-val-accent-light`}
      >
        <LogIn className="h-3 w-3" />
        Sign in to add
      </a>
    );
  }

  if (variants.length === 0 || sizes.length === 0) {
    return (
      <button
        onClick={addWhole}
        onClickCapture={(e) => e.stopPropagation()}
        className={`${barClass} ${
          pendingAdded > 0
            ? "bg-emerald-500 text-black"
            : "bg-white text-black hover:bg-val-silver"
        }`}
      >
        {pendingAdded > 0 ? (
          <>
            <Check className="h-3 w-3" />
            Added {pendingAdded}
          </>
        ) : (
          <>
            <ShoppingCart className="h-3 w-3" />
            Add to cart
          </>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      {/*
       * Only when there is a choice. A single-colour product needs no colour
       * picker, and rendering one was most of why the old overlay felt like
       * scaffolding bolted onto the photograph.
       */}
      {colors.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {colors.map((color) => {
            const isSelected = color === selectedColor;
            return (
              <div key={color} className="group/swatch relative">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedColor(color);
                  }}
                  aria-label={color}
                  aria-pressed={isSelected}
                  className={`relative block h-3.5 w-8 overflow-hidden rounded-full transition-all ${
                    isSelected
                      ? "ring-1 ring-white"
                      : "opacity-60 ring-1 ring-white/30 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: resolveColorHex(color) }}
                >
                  {/* Top highlight, so the capsule reads as a cylinder and a
                      near-black colour still has form against the photo. */}
                  <span className="absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/30 to-transparent" />
                </button>

                {/* Nothing clips this now the scroll window is gone, so it can
                    be pure CSS rather than tracked in state. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 translate-y-1 rounded-sm bg-white px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-black opacity-0 shadow-lg transition-all duration-150 group-hover/swatch:translate-y-0 group-hover/swatch:opacity-100 group-focus-within/swatch:translate-y-0 group-focus-within/swatch:opacity-100"
                >
                  {color}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Every size at once. The press that picks is the press that adds. */}
      <div className="flex flex-wrap gap-1">
        {sizeStates.map((state) => {
          const showCount = state.size === lastAddedSize && pendingAdded > 0;
          const stopped = !state.inStock || state.atCeiling;

          return (
            <button
              key={state.size}
              onClick={(e) => add(e, state)}
              disabled={stopped}
              title={
                !state.inStock
                  ? `${state.size} — sold out`
                  : state.atCeiling
                    ? `${state.size} — all ${state.inCart} in cart`
                    : `Add ${state.size} to cart`
              }
              className={`min-w-8 flex-1 basis-8 rounded-sm py-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase transition-colors ${
                showCount
                  ? "bg-emerald-500 text-black"
                  : !state.inStock
                    ? // Struck through rather than hidden: which sizes a
                      // product comes in is information even when they are
                      // gone, and a missing chip reads as a layout bug.
                      "cursor-not-allowed text-white/30 line-through"
                    : state.atCeiling
                      ? "cursor-not-allowed bg-white/5 text-white/40"
                      : "bg-white/15 text-white backdrop-blur-sm hover:bg-white hover:text-black"
              }`}
            >
              {showCount ? `+${pendingAdded}` : state.size}
            </button>
          );
        })}
      </div>
    </div>
  );
}
