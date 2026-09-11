"use client";

/**
 * Collection Toolbar — the band that used to be empty.
 *
 * Sticks directly beneath the navbar, which is `sticky top-0 z-50` at
 * `h-14 md:h-16`. This sits at `z-30` so it passes under the navbar rather
 * than over it.
 *
 * Chips filter in place rather than navigating. `/collections/[slug]` stays the
 * canonical route reached from the navigation; these are an in-page refinement,
 * which is what lets Sale and New be filtered by category at all — there is no
 * `/collections/sale/tops` route and there should not be one.
 *
 * Each chip carries its category's *subtree* ids, never its own id alone. Every
 * product is filed against a leaf category while the navigation links to
 * parents, so matching a single id emptied every parent collection.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCT_SORTS, type ProductSort } from "@/lib/collection-sort";
import { cn } from "@/lib/utils";

export interface ToolbarCategory {
  slug: string;
  name: string;
  /** The category and its descendants, resolved server-side. */
  categoryIds: string[];
}

export interface CollectionToolbarProps {
  categories: ToolbarCategory[];
  activeSlug: string | null;
  sort: ProductSort;
  shownCount: number;
  totalCount: number;
  onCategoryChange: (slug: string | null) => void;
  onSortChange: (sort: ProductSort) => void;
}

export function CollectionToolbar({
  categories,
  activeSlug,
  sort,
  shownCount,
  totalCount,
  onCategoryChange,
  onSortChange,
}: CollectionToolbarProps) {
  return (
    <div className="sticky top-14 z-30 border-b border-white/10 bg-black/80 backdrop-blur-xl md:top-16">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div
          className="-mx-1 flex flex-1 items-center gap-1 overflow-x-auto px-1 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Filter by category"
        >
          <Chip
            label="All"
            active={activeSlug === null}
            onClick={() => onCategoryChange(null)}
          />
          {categories.map((category) => (
            <Chip
              key={category.slug}
              label={category.name}
              active={activeSlug === category.slug}
              onClick={() => onCategoryChange(category.slug)}
            />
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <span className="hidden text-[11px] uppercase tracking-[0.24em] text-gray-500 sm:inline">
            {shownCount} / {totalCount}
          </span>

          <Select
            value={sort}
            onValueChange={(value) => onSortChange(value as ProductSort)}
          >
            <SelectTrigger
              className="h-9 w-[172px] border-white/15 bg-transparent text-xs uppercase tracking-[0.18em] text-gray-300"
              aria-label="Sort products"
            >
              <SelectValue />
            </SelectTrigger>
            {/* Portalled to <body>: both halves of the token pair, or this
                renders white-on-white under the light palette. */}
            <SelectContent className="border-white/15 bg-popover text-popover-foreground">
              {PRODUCT_SORTS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="text-xs"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative shrink-0 whitespace-nowrap px-3 py-2 text-[11px] uppercase tracking-[0.24em] transition-colors duration-200",
        active ? "text-white" : "text-gray-500 hover:text-gray-300"
      )}
    >
      {label}
      <span
        className={cn(
          "absolute inset-x-3 bottom-1 h-px origin-left bg-val-accent transition-transform duration-300 ease-out",
          active ? "scale-x-100" : "scale-x-0"
        )}
      />
    </button>
  );
}
