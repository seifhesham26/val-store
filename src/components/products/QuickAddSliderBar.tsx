/**
 * Quick Add Slider Bar
 *
 * Inline vertical odometer-style size & color selectors for ProductCard.
 * Uses CSS scroll-snap for a premium "wheel picker" feel.
 * Layout: [Size wheel] [Color wheel] [Add button] in a horizontal row,
 * each wheel scrolls vertically like a real odometer.
 */

"use client";

import { useState } from "react";
import { useCart, useCartAddDelta } from "@/components/providers/cart-provider";
import { toast } from "sonner";

import { VerticalWheel } from "@/components/products/quick-add/VerticalWheel";
import { QuickAddButton } from "@/components/products/quick-add/QuickAddButton";
import { useVariantStock } from "@/hooks/use-variant-stock";
import { quantityInCart, remainingCapacity } from "@/lib/cart-stock-limit";

export interface QuickAddVariant {
  id: string;
  size: string | null;
  color: string | null;
  inStock: boolean;
}

interface QuickAddSliderBarProps {
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

export function QuickAddSliderBar({
  productId,
  productName,
  productImage,
  productPrice,
  variants,
}: QuickAddSliderBarProps) {
  // Derive unique sizes and colors from variants
  const sizes = Array.from(
    new Set(variants.map((v) => v.size).filter(Boolean) as string[])
  );
  const colors = Array.from(
    new Set(variants.map((v) => v.color).filter(Boolean) as string[])
  );

  const [sizeIndex, setSizeIndex] = useState(0);
  const [colorIndex, setColorIndex] = useState(0);

  // Shares the same cached stock query as the product page — one fetch per set
  // of variants, refreshed in the background, not one request per add.
  const stock = useVariantStock(variants.map((v) => v.id));

  const { addItem, isAuthenticated, items } = useCart();

  const selectedSize = sizes[sizeIndex] || null;
  const selectedColor = colors[colorIndex] || null;

  // Check if the selected combination is in stock
  const matchingVariant = variants.find(
    (v) =>
      (selectedSize === null || v.size === selectedSize) &&
      (selectedColor === null || v.color === selectedColor)
  );
  const variantId = matchingVariant?.id ?? null;

  // Live figure when the cache has it, otherwise the flag the grid was rendered
  // with.
  const liveStock = stock.get(matchingVariant?.id);
  const inStock =
    liveStock !== null ? liveStock > 0 : (matchingVariant?.inStock ?? false);

  // What the cart already holds is part of the ceiling: the server checks
  // `already in cart + requested <= stock`, and the customer should not have to
  // discover that by being refused.
  const inCartQuantity = quantityInCart(items, productId, variantId);
  const remaining = remainingCapacity(liveStock, inCartQuantity);
  const atCeiling = inStock && remaining === 0;

  // Units this button has queued that the server has not confirmed. Replaces
  // the old fixed 2s "Added!" flag, which under burst pressing re-armed thirty
  // times and said nothing about whether press seven landed.
  const pendingAdded = useCartAddDelta(productId, variantId);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!inStock) {
      toast.error("This combination is out of stock");
      return;
    }

    // The button is disabled at the ceiling; this is the belt to that pair of
    // braces, and it is what makes "the thirty-first press issues no request"
    // true at the call site rather than only in the arithmetic.
    if (remaining <= 0) return;

    // Local and immediate. Thirty presses become one additive `cart.add`; a
    // refusal surfaces from the provider as a toast with a Retry action.
    addItem(productId, 1, variantId, {
      productName,
      productPrice,
      productImage: productImage ?? null,
      variantLabel:
        [selectedSize, selectedColor].filter(Boolean).join(" / ") || null,
      // The grid's variant shape carries only a boolean, so when the live
      // cache has no figure yet we allow one unit and let the server resolve
      // the real ceiling.
      maxStock: liveStock ?? 1,
    });

    // No `openCart()` here on purpose: with burst pressing, press one would
    // slide the drawer over the card still being pressed. The navbar badge and
    // the button's own "Added N" are the confirmation.
  };

  // If no variants at all, show a simple fallback
  if (variants.length === 0) {
    return (
      <button
        onClick={handleQuickAdd}
        className="w-full bg-white text-black hover:bg-val-silver text-sm py-2 rounded-md font-medium transition-colors"
      >
        Quick Add
      </button>
    );
  }

  return (
    <div
      className="flex items-end gap-2 w-full"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Vertical Odometer Wheels */}
      <div className="flex gap-1.5 flex-1">
        {sizes.length > 0 && (
          <VerticalWheel
            label="Size"
            items={sizes}
            selectedIndex={sizeIndex}
            onSelect={setSizeIndex}
          />
        )}
        {colors.length > 0 && (
          <VerticalWheel
            label="Color"
            items={colors}
            selectedIndex={colorIndex}
            onSelect={setColorIndex}
          />
        )}
      </div>

      {/* Add to Cart Button — right side */}
      <div className="flex-1 min-w-0">
        <QuickAddButton
          isAuthenticated={isAuthenticated}
          inStock={inStock}
          atCeiling={atCeiling}
          inCartQuantity={inCartQuantity}
          pendingAdded={pendingAdded}
          onAdd={handleQuickAdd}
        />
      </div>
    </div>
  );
}
