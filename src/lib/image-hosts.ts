/**
 * Image hosts Next.js is allowed to optimise.
 *
 * One list, imported by `next.config.ts` (which turns it into `remotePatterns`)
 * and by `shouldOptimizeImage` below, so the two can never disagree — a host
 * added to the config but not the guard would still be served unoptimised, and
 * a host in the guard but not the config makes the optimiser return a 400 and
 * the image disappear.
 *
 * Every storefront `<Image>` used to pass `unoptimized`, which skips Next's
 * optimiser entirely: the homepage hero downloaded a full 1920×1080 original as
 * the LCP element, and each product card downloaded the original behind a
 * 300px-wide slot. The flag was doing one useful job — never breaking on an
 * image URL from an unexpected host — so rather than dropping it, the decision
 * is made per URL.
 */
export const REMOTE_IMAGE_HOSTS = [
  "picsum.photos",
  "utfs.io",
  "lh3.googleusercontent.com",
] as const;

/**
 * The subset Next is allowed to *optimise*, as opposed to merely render.
 *
 * `picsum.photos` is deliberately absent. Optimising means Next fetches the
 * image server-to-server, and picsum answers those with 503 (and eventually
 * 522) — verified against the live host, not assumed — so routing seed imagery
 * through the optimiser replaces working pictures with broken ones. Letting the
 * browser fetch picsum directly is what has always happened and it works.
 *
 * That costs nothing real: picsum is placeholder data. Every genuine product
 * image is uploaded to UploadThing (`utfs.io`), which is in the list and does
 * get AVIF/WebP conversion and a correctly-sized srcset.
 */
export const OPTIMIZED_IMAGE_HOSTS = [
  "utfs.io",
  "lh3.googleusercontent.com",
] as const;

/**
 * Should Next optimise this image?
 *
 * Local paths (`/logo/…`) are always optimisable. Remote URLs are optimised
 * only from a host in the list; anything else — an admin pasting a URL from a
 * host nobody has configured — is passed through untouched rather than 400ing.
 */
export function shouldOptimizeImage(src: string | null | undefined): boolean {
  if (!src) return false;
  if (src.startsWith("/")) return true;

  try {
    const { hostname } = new URL(src);
    return OPTIMIZED_IMAGE_HOSTS.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`)
    );
  } catch {
    // Not a URL we can parse; leave it alone.
    return false;
  }
}

/** Inverse of `shouldOptimizeImage`, for `<Image unoptimized={…}>`. */
export function unoptimizedFor(src: string | null | undefined): boolean {
  return !shouldOptimizeImage(src);
}
