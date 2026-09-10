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
 * Four columns, two rows — eight cells. The featured tile occupies four of
 * them, leaving exactly four for the remaining collections (Men, Women, Sale,
 * All Products). A three-column grid leaves only two cells free and silently
 * pushes the fourth tile onto a third row.
 */
export function CollectionMosaic({ tiles }: { tiles: MosaicTile[] }) {
  const revealRef = useReveal<HTMLDivElement>();

  return (
    <div
      ref={revealRef}
      className="mx-auto grid max-w-[1600px] gap-4 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:grid-rows-2 lg:px-8"
    >
      {tiles.map((tile) => (
        <Link
          key={tile.href}
          href={tile.href}
          className={cn(
            "val-reveal group relative overflow-hidden rounded-xl border border-white/10 transition-colors duration-300 hover:border-white/25",
            tile.featured
              ? "sm:col-span-2 lg:row-span-2 min-h-[280px] lg:min-h-[520px]"
              : "min-h-[200px] lg:min-h-[254px]"
          )}
          data-reveal
        >
          <Image
            src={tile.image}
            alt=""
            fill
            sizes={
              tile.featured
                ? "(min-width: 1024px) 50vw, 100vw"
                : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            }
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
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
