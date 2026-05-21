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
import { useCart } from "@/components/providers/cart-provider";
import { toast } from "sonner";

import { VerticalWheel } from "@/components/products/quick-add/VerticalWheel";
import { QuickAddButton } from "@/components/products/quick-add/QuickAddButton";

export interface QuickAddVariant {
  id: string;
  size: string | null;
  color: string | null;
  inStock: boolean;
}

interface QuickAddSliderBarProps {
  productId: string;
  productName: string;
  variants: QuickAddVariant[];
}

export function QuickAddSliderBar({
  productId,
  productName,
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
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const { addItem, openCart, isAuthenticated } = useCart();

  const selectedSize = sizes[sizeIndex] || null;
  const selectedColor = colors[colorIndex] || null;

  // Check if the selected combination is in stock
  const matchingVariant = variants.find(
    (v) =>
      (selectedSize === null || v.size === selectedSize) &&
      (selectedColor === null || v.color === selectedColor)
  );
  const inStock = matchingVariant?.inStock ?? false;

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.info("Please sign in to add items to your cart", {
        action: {
          label: "Sign In",
          onClick: () => {
            window.location.href = `/login?redirect=${encodeURIComponent(
              window?.location?.pathname || "/"
            )}`;
          },
        },
      });
      return;
    }

    if (!inStock) {
      toast.error("This combination is out of stock");
      return;
    }

    setIsAdding(true);
    try {
      await addItem(productId, 1);
      setJustAdded(true);
      toast.success(`${productName} added to cart`);
      openCart();
      setTimeout(() => setJustAdded(false), 2000);
    } catch {
      toast.error("Failed to add to cart");
    } finally {
      setIsAdding(false);
    }
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
          isAdding={isAdding}
          justAdded={justAdded}
          inStock={inStock}
          onAdd={handleQuickAdd}
        />
      </div>
    </div>
  );
}
