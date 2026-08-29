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
          <label className="block text-sm font-medium text-white mb-3">
            Color: {selectedColor}
          </label>
          <div className="flex flex-wrap gap-3">
            {colors.map((color) => {
              const isSelected = selectedColor === color.name;
              return (
                <button
                  key={color.name}
                  onClick={() => onSelectColor(color.name)}
                  title={color.name}
                  aria-label={color.name}
                  aria-pressed={isSelected}
                  className={`relative h-10 w-10 rounded-full transition-all ${
                    isSelected
                      ? "ring-2 ring-white ring-offset-2 ring-offset-black"
                      : "ring-1 ring-white/25 hover:ring-white/60"
                  }`}
                >
                  {/* Inner disc keeps light swatches legible against the
                      black page while the ring shows selection state. */}
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: color.hex }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Size Selection */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-white">
            Size: {selectedSize || "Select a size"}
          </label>
          <button className="text-sm text-val-accent hover:underline">
            Size Guide
          </button>
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
