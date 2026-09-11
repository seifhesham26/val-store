"use client";

/**
 * Collection Mosaic — what replaced the centered header and the "Browse All"
 * strip on `/collections`.
 *
 * The page previously opened with a centered title, a thin full-width link, and
 * then three stacked four-card rows separated by 64px. The top third of the
 * page displayed four lines of text across 1600px.
 *
 * The featured tile spans two columns and both rows; the rest fill in beside it.
 */

import Image from "next/image";
import Link from "next/link";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

export interface MosaicTile {
  title: string;
  href: string;
  image: string;
  /** Omitted where there is no single meaningful number, e.g. "All Products". */
  count?: number;
  /** Spans two columns and two rows. Exactly one tile should set this. */
  featured?: boolean;
}

/**
 * Two rows, with the featured tile spanning two columns and both rows.
 *
 * The column count has to follow the tile count, because the tile count is
 * data: a category an admin has not created resolves to null and its tile
 * simply does not exist. The featured tile eats four cells, so a three-column
 * grid (six cells) holds exactly three tiles and a four-column grid (eight)
 * holds exactly five.
 *
 * Hard-coding four columns left two cells empty whenever a category was
 * missing — a black quadrant roughly a quarter of the viewport wide, which is
 * the same dead space this mosaic replaced. At exactly four tiles one cell
 * would still be spare, so the last tile widens to close the row.
 */
export function CollectionMosaic({ tiles }: { tiles: MosaicTile[] }) {
  const revealRef = useReveal<HTMLDivElement>();

  // Literal class strings, not interpolation — Tailwind scans source text and
  // cannot see a class name assembled at runtime.
  const columns = tiles.length <= 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  const lastFillsRow = tiles.length === 4;

  return (
    <div
      ref={revealRef}
      className={cn(
        "mx-auto grid max-w-[1600px] gap-4 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-rows-2 lg:px-8",
        columns
      )}
    >
      {tiles.map((tile, index) => (
        <Link
          key={tile.href}
          href={tile.href}
          className={cn(
            "val-reveal group relative overflow-hidden rounded-xl border border-white/10 transition-colors duration-300 hover:border-white/25",
            // Aspect ratios, not fixed heights. `min-h` is a floor that does
            // not move when the column does, so on a wide screen every extra
            // pixel of viewport width went into cropping the tile rather than
            // into showing it: a 4:5 portrait at 2xl was a 3:1 letterbox
            // through the model's chest. A ratio scales the box with the
            // column, and `max-w-[1600px]` above stops it growing past that,
            // so the crop is identical on a 1440 and on a 4K display.
            //
            // At `lg` the non-featured tiles set the row height, so the
            // featured tile spanning 2 columns x 2 rows lands on the same
            // ratio they do — which is why it can be `aspect-auto` there.
            tile.featured
              ? "aspect-[5/4] sm:col-span-2 sm:aspect-video lg:row-span-2 lg:aspect-auto lg:min-h-[420px]"
              : "aspect-[5/4] sm:aspect-[4/5] lg:aspect-square",
            // The widened tile is two columns across but still one row tall,
            // so it cannot keep the square: `aspect-auto` hands its height
            // back to the row. `cn` is tailwind-merge, so this beats the
            // `lg:aspect-square` above rather than fighting it.
            lastFillsRow &&
              !tile.featured &&
              index === tiles.length - 1 &&
              "lg:col-span-2 lg:aspect-auto"
          )}
          data-reveal
        >
          <Image
            src={tile.image}
            alt=""
            fill
            // The featured tile is the LCP element on `/collections` — it is
            // the largest thing above the fold and it got larger when these
            // boxes stopped being fixed-height. Next's dev overlay flags it by
            // name; the rest of the mosaic stays lazy.
            priority={tile.featured}
            sizes={
              tile.featured
                ? "(min-width: 1024px) 50vw, 100vw"
                : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            }
            // The sources are 4:5 portraits; only the `sm` box matches them,
            // so everywhere else this crops vertically. Biased upward —
            // centred, the wide boxes decapitated every model.
            className="object-cover object-[50%_30%] transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 p-5 transition-transform duration-300 ease-out group-hover:-translate-y-1">
            <h2
              className={cn(
                "font-semibold uppercase tracking-[0.14em] text-white",
                tile.featured ? "text-2xl lg:text-3xl" : "text-base lg:text-lg"
              )}
            >
              {tile.title}
            </h2>
            {tile.count !== undefined ? (
              <p className="mt-1 text-[11px] uppercase tracking-[0.28em] text-gray-400">
                {tile.count} {tile.count === 1 ? "Product" : "Products"}
              </p>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
