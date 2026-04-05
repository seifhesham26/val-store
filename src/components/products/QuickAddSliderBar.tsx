/**
 * Quick Add Slider Bar
 *
 * Inline vertical odometer-style size & color selectors for ProductCard.
 * Uses CSS scroll-snap for a premium "wheel picker" feel.
 * Layout: [Size wheel] [Color wheel] [Add button] in a horizontal row,
 * each wheel scrolls vertically like a real odometer.
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ShoppingCart,
  Check,
  Loader2,
  LogIn,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useCart } from "@/components/providers/cart-provider";
import { toast } from "sonner";

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

// ─── Vertical Odometer Wheel ────────────────────────────────────
const ITEM_HEIGHT = 24; // px per slot

function VerticalWheel({
  label,
  items,
  selectedIndex,
  onSelect,
}: {
  label: string;
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll to selected item
  useEffect(() => {
    if (scrollRef.current && !isUserScrolling.current) {
      scrollRef.current.scrollTo({
        top: selectedIndex * ITEM_HEIGHT,
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  const handleScroll = useCallback(() => {
    isUserScrolling.current = true;
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

    scrollTimeout.current = setTimeout(() => {
      if (!scrollRef.current) return;
      const snappedIndex = Math.round(
        scrollRef.current.scrollTop / ITEM_HEIGHT
      );
      const clamped = Math.max(0, Math.min(snappedIndex, items.length - 1));
      if (clamped !== selectedIndex) {
        onSelect(clamped);
      }
      isUserScrolling.current = false;
    }, 80);
  }, [selectedIndex, onSelect, items.length]);

  const nudge = (dir: -1 | 1, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = Math.max(0, Math.min(selectedIndex + dir, items.length - 1));
    onSelect(next);
  };

  return (
    <div
      className="flex flex-col items-center gap-0"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Label */}
      <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 select-none">
        {label}
      </span>

      <div className="flex flex-col items-center">
        {/* Up arrow */}
        <button
          onClick={(e) => nudge(-1, e)}
          className="text-gray-600 hover:text-white transition-colors h-3 flex items-center justify-center"
          aria-label={`Previous ${label}`}
        >
          <ChevronUp className="h-2.5 w-2.5" />
        </button>

        {/* Scroll window — shows 1 item at a time with peek above/below */}
        <div
          className="relative overflow-hidden rounded border border-white/15 bg-black/70 backdrop-blur-sm"
          style={{ height: ITEM_HEIGHT * 3, width: 52 }}
        >
          {/* Fade edges */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-linear-to-b from-black/80 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-linear-to-t from-black/80 to-transparent z-10" />
          {/* Center highlight */}
          <div
            className="pointer-events-none absolute inset-x-0 z-10 border-y border-val-accent/50"
            style={{ top: ITEM_HEIGHT, height: ITEM_HEIGHT }}
          />

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto snap-y snap-mandatory"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {/* Top padding spacer */}
            <div style={{ height: ITEM_HEIGHT }} />
            {items.map((item, i) => (
              <button
                key={item}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(i);
                }}
                className="snap-center w-full flex items-center justify-center transition-all duration-150 select-none"
                style={{ height: ITEM_HEIGHT }}
              >
                <span
                  className={`text-[11px] font-semibold tracking-wide transition-all duration-200 ${
                    i === selectedIndex
                      ? "text-white scale-110"
                      : "text-gray-600 scale-90"
                  }`}
                >
                  {item}
                </span>
              </button>
            ))}
            {/* Bottom padding spacer */}
            <div style={{ height: ITEM_HEIGHT }} />
          </div>
        </div>

        {/* Down arrow */}
        <button
          onClick={(e) => nudge(1, e)}
          className="text-gray-600 hover:text-white transition-colors h-3 flex items-center justify-center"
          aria-label={`Next ${label}`}
        >
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
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
        {!isAuthenticated ? (
          <a
            href={`/login?redirect=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-1 w-full bg-val-accent hover:bg-val-accent/90 text-white text-[10px] py-2 rounded-md font-semibold transition-colors"
          >
            <LogIn className="h-3 w-3" />
            Sign In
          </a>
        ) : (
          <button
            onClick={handleQuickAdd}
            disabled={isAdding || !inStock}
            className={`flex items-center justify-center gap-1 w-full text-[10px] py-2 rounded-md font-semibold transition-all duration-200 ${
              !inStock
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : justAdded
                  ? "bg-green-600 text-white"
                  : "bg-white text-black hover:bg-val-silver"
            }`}
          >
            {isAdding ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Adding
              </>
            ) : justAdded ? (
              <>
                <Check className="h-3 w-3" />
                Added!
              </>
            ) : !inStock ? (
              "Sold Out"
            ) : (
              <>
                <ShoppingCart className="h-3 w-3" />
                Add
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
