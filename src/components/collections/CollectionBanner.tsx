/**
 * Collection Banner — the scrim split.
 *
 * Full-bleed, no container. Text left, photograph bleeding off the right edge,
 * with a gradient scrim dissolving the seam between them rather than butting
 * one against the other.
 *
 * It replaces a centered `max-w-7xl` header that used the widest element on the
 * page to display three centered lines, and it absorbs the orphaned
 * "Showing X of Y products" into a meta row that gives the left column a floor.
 *
 * The left padding intentionally matches the product grid's gutter below, so
 * the headline's left edge and the first card's left edge share an axis.
 *
 * Below `lg` the photograph does not stack — it becomes a dimmed layer behind
 * the text, so a phone does not inherit a 700px header.
 */

import Image from "next/image";
import { STORE_CURRENCY } from "@/lib/currency";

export interface CollectionBannerProps {
  eyebrow?: string;
  title: string;
  description?: string;
  image: string;
  /** Rendered in the meta row. Omitted for surfaces with no single count. */
  productCount?: number;
}

export function CollectionBanner({
  eyebrow,
  title,
  description,
  image,
  productCount,
}: CollectionBannerProps) {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/10">
      {/* Mobile: photograph as a dimmed backdrop rather than a stacked block. */}
      <div className="absolute inset-0 lg:hidden">
        <Image
          src={image}
          alt=""
          fill
          priority
          sizes="100vw"
          // Anchored to the right edge, not centred. Below `lg` the frame is
          // proportionally *narrower* than the 16:9 source, so the crop is
          // horizontal — and every banner in the set is composed with its
          // subject in the right third and the left two-thirds left empty for
          // the desktop scrim (see `temp/prompts/README.md`). Centring the
          // crop therefore cut into the only part of the photograph with
          // anything in it. `100%` keeps the whole subject and throws away the
          // empty left side. The `30%` still applies on a short, wide frame,
          // where the crop turns vertical instead.
          className="object-cover object-[100%_30%]"
        />
        {/*
         * One scrim, not two. This was `opacity-25` on the image *and* a
         * `bg-black/70` over it: 0.25 x 0.30 = 7.5% of an already low-key
         * photograph, which renders as a plain black rectangle on every phone
         * — the exact dead space this banner was built to remove. A single
         * gradient does the legibility job and leaves the picture a picture.
         * Denser at top and bottom because the eyebrow and the meta row are
         * the smallest, lowest-contrast text on the banner.
         */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/60 to-black/85" />
      </div>

      <div className="relative grid min-h-[clamp(340px,40vh,560px)] lg:grid-cols-[1fr_0.8fr]">
        <div className="flex flex-col justify-center gap-5 px-4 py-14 sm:px-6 lg:px-8 xl:pl-[max(2rem,calc((100vw-1600px)/2+2rem))]">
          {eyebrow ? (
            <div className="val-reveal flex items-center gap-4" data-reveal>
              <span className="text-[11px] font-medium uppercase tracking-[0.32em] text-val-silver/50">
                {eyebrow}
              </span>
              <span className="h-px w-10 bg-white/25" />
            </div>
          ) : null}

          <h1
            className="val-reveal text-[clamp(2.25rem,5.5vw,4rem)] font-semibold uppercase leading-[1.05] tracking-[0.12em] text-white"
            data-reveal
          >
            {title}
          </h1>

          {description ? (
            <p
              className="val-reveal max-w-[46ch] text-sm leading-relaxed text-gray-400 sm:text-base"
              data-reveal
            >
              {description}
            </p>
          ) : null}

          <div
            className="val-reveal flex flex-wrap items-center gap-4 text-[11px] uppercase tracking-[0.28em] text-gray-500"
            data-reveal
          >
            {productCount !== undefined ? (
              <>
                <span>
                  {productCount} {productCount === 1 ? "Product" : "Products"}
                </span>
                <span className="h-px w-8 bg-white/15" />
              </>
            ) : null}
            <span>Premium Quality</span>
            <span className="h-px w-8 bg-white/15" />
            <span>{STORE_CURRENCY}</span>
          </div>
        </div>

        {/* Desktop photograph. The scrim dissolves its left edge into the page. */}
        <div className="relative hidden lg:block">
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="45vw"
            // Right-anchored for the same reason as the mobile layer above:
            // this panel is narrower than the 16:9 source, so it crops
            // horizontally, and `object-center` was cutting roughly the last
            // 15% off the right — which is precisely where the subject is
            // composed. It is also the end of the scrim's fade, so the subject
            // now lands on the clearest part of the panel rather than under
            // the darkest part of it.
            className="object-cover object-[100%_30%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/55 to-transparent" />
        </div>
      </div>
    </section>
  );
}
