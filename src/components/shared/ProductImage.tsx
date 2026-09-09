import Image from "next/image";
import { cn } from "@/lib/utils";
import { unoptimizedFor } from "@/lib/image-hosts";

interface ProductImageProps {
  src: string;
  alt: string;
  /**
   * Passed to BOTH layers unchanged. See "one download, not two" below —
   * this is not an oversight.
   */
  sizes: string;
  priority?: boolean;
  /** Extra classes for the foreground layer only, e.g. hover transforms. */
  className?: string;
  /**
   * Fires when the foreground image has decoded. The product card waits for
   * this before starting its crossfade, so a slow connection degrades to a
   * still card rather than fading to an empty frame.
   */
  onLoad?: () => void;
}

/**
 * A product photo that fills a fixed-aspect frame without ever cropping it.
 *
 * The storefront is standardised on 3:4 portrait, and every frame used to
 * fill itself with `object-cover`. On a 3.9:1 source — the `coming-soon`
 * wordmark used as a product image is the case that prompted this — that
 * keeps a narrow vertical slice and throws the picture away.
 *
 * Instead: the whole image on `object-contain`, over a blurred, scaled copy
 * of itself on `object-cover` filling the letterbox bars. Any aspect ratio
 * then reads as a deliberate tile.
 *
 * **It is self-disabling.** For a source already at the frame's ratio there
 * are no bars, `object-contain` and `object-cover` paint identically, and the
 * blur layer is completely occluded. So there is no aspect detection, no
 * conditional, and no per-image configuration — one code path is correct for
 * a square, a portrait, a panorama and a 3:4 product shot alike.
 *
 * ## One download, not two
 *
 * Both layers take the identical `src` AND the identical `sizes`. Next then
 * generates the same `srcset` for both, the browser picks the same candidate
 * URL for both, and the second request is served from cache — two layers,
 * one download.
 *
 * The tempting change is to give the blur layer something like
 * `sizes="64px"`, reasoning that a blurred backdrop needs no resolution.
 * That selects a *different* srcset entry, which is a different URL, which
 * is a second network request. It makes the page slower while looking like
 * an optimisation. Do not make it.
 *
 * `scale-110` is also load-bearing: `blur-2xl` leaves a soft translucent
 * edge, and without the overscan a pale halo traces the frame.
 */
export function ProductImage({
  src,
  alt,
  sizes,
  priority,
  className,
  onLoad,
}: ProductImageProps) {
  const unoptimized = unoptimizedFor(src);

  return (
    <>
      <Image
        src={src}
        alt=""
        aria-hidden
        fill
        sizes={sizes}
        className="object-cover scale-110 blur-2xl"
        unoptimized={unoptimized}
      />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        className={cn("object-contain", className)}
        unoptimized={unoptimized}
        onLoad={onLoad}
      />
    </>
  );
}
