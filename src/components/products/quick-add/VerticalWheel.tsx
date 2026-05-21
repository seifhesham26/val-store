"use client";

import { useRef, useCallback, useEffect } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

const ITEM_HEIGHT = 24; // px per slot

interface VerticalWheelProps {
  label: string;
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function VerticalWheel({
  label,
  items,
  selectedIndex,
  onSelect,
}: VerticalWheelProps) {
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
