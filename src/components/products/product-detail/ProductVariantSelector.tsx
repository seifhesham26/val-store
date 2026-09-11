"use client";

import { Minus, Plus } from "lucide-react";

interface ProductVariantSelectorProps {
  colors?: { name: string; hex: string }[];
  sizes: string[];
  selectedColor: string | null;
  selectedSize: string | null;
  quantity: number;
  onSelectColor: (color: string) => void;
  onSelectSize: (size: string) => void;
  onChangeQuantity: (quantity: number) => void;
  /** Stock ceiling for the chosen variant; null when nothing is chosen yet. */
  maxQuantity?: number | null;
}

export function ProductVariantSelector({
  colors,
  sizes,
  selectedColor,
  selectedSize,
  quantity,
  onSelectColor,
  onSelectSize,
  onChangeQuantity,
  maxQuantity = null,
}: ProductVariantSelectorProps) {
  return (
    <>
      {/* Color Selection */}
      {colors && colors.length > 0 && (
        <div className="mb-6">
          {/*
           * The label is just "Colour" now, with the selected name on the
           * right of the same row rather than appended to it.
           *
           * `Color: {selectedColor}` put a variable-length value inside a
           * heading, so a real catalogue name — "Heather Charcoal", "Deep
           * Steel Blue" — wrapped onto a second line and pushed the swatches
           * down. Splitting the row means the label never moves however long
           * the colour is called, and `truncate` caps the pathological case.
           */}
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-white">Colour</span>
            {selectedColor && (
              <span className="truncate text-sm text-white/60">
                {selectedColor}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {colors.map((color) => {
              const isSelected = selectedColor === color.name;
              return (
                /*
                 * `group` + a CSS-only tooltip rather than the Radix primitive.
                 *
                 * This needs one label on hover. Radix Tooltip would add a
                 * dependency and a portal, and a portalled surface here has to
                 * set both halves of a colour pair or it inherits the
                 * storefront's white text into the light-themed admin — the
                 * bug family `globals.css` documents. A sibling span costs
                 * neither.
                 *
                 * The accessible name lives on the button, so the tooltip is
                 * `aria-hidden` — a screen reader announces the colour once,
                 * not twice.
                 */
                <div key={color.name} className="group relative">
                  <button
                    onClick={() => onSelectColor(color.name)}
                    aria-label={color.name}
                    aria-pressed={isSelected}
                    className={`relative block h-9 w-14 overflow-hidden rounded-full transition-all ${
                      isSelected
                        ? "ring-2 ring-white ring-offset-2 ring-offset-black"
                        : "ring-1 ring-white/25 hover:ring-white/60 focus-visible:ring-white/60"
                    }`}
                  >
                    <span
                      className="absolute inset-0"
                      style={{ backgroundColor: color.hex }}
                    />
                    {/*
                     * A soft highlight across the top third, so the pill reads
                     * as a cylinder rather than a flat lozenge — and so a very
                     * dark colour still has visible form against the black
                     * page instead of disappearing into it.
                     */}
                    <span className="absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/25 to-transparent" />
                  </button>

                  {/* Purely visual: no `role="tooltip"`, because the button's
                      `aria-label` already carries the name and a role on
                      `aria-hidden` content contradicts itself. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 translate-y-1 rounded-sm bg-white px-2 py-1 text-xs font-medium whitespace-nowrap text-black opacity-0 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                  >
                    {color.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Size Selection */}
      <div className="mb-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {/* Same split as the colour row above, for the same reason and so
              the two read as one system. */}
          <span className="text-sm font-medium text-white">Size</span>
          <div className="flex items-baseline gap-4">
            <span className="text-sm text-white/60">
              {selectedSize || "Select a size"}
            </span>
            <button className="text-sm text-val-accent-light hover:underline">
              Size Guide
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {sizes.map((size) => (
            <button
              key={size}
              onClick={() => onSelectSize(size)}
              className={`px-4 py-2 border rounded-md transition-all ${
                selectedSize === size
                  ? "bg-white text-black border-white"
                  : "border-white/20 text-white hover:border-white"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-white mb-3">
          Quantity
        </label>
        <div className="flex items-center gap-4">
          <div className="flex items-center border border-white/20 rounded-md">
            <button
              onClick={() => onChangeQuantity(Math.max(1, quantity - 1))}
              className="p-3 text-white hover:bg-white/10 transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="px-4 text-white font-medium">{quantity}</span>
            <button
              onClick={() =>
                onChangeQuantity(
                  maxQuantity === null
                    ? quantity + 1
                    : Math.min(quantity + 1, maxQuantity)
                )
              }
              disabled={maxQuantity !== null && quantity >= maxQuantity}
              className="p-3 text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {maxQuantity !== null && maxQuantity > 0 && maxQuantity <= 5 && (
            <span className="text-sm text-amber-400">
              Only {maxQuantity} left
            </span>
          )}
        </div>
      </div>
    </>
  );
}
