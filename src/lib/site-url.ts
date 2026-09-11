/**
 * The canonical public origin of this deployment.
 *
 * One declaration, for the same reason `currency.ts` exists: the origin was
 * previously re-derived at four call sites, each with its own
 * `process.env.X || "http://localhost:3000"` fallback, and each of them silently
 * correct in development and wrong in production.
 *
 * It matters more than it looks. This value ends up in the payment gateway's
 * `success_url`, in every link in every transactional email, in `sitemap.xml`, in the
 * `<link rel="canonical">` of every page and in the `og:image` of every shared
 * link. A wrong value does not throw — it sends a paying customer to a domain
 * that is not yours, or tells Google to index one.
 *
 * ## Why the fallback is the real domain and not localhost
 *
 * A missing `NEXT_PUBLIC_APP_URL` in production used to mean the payment
 * gateway redirected the customer to `http://localhost:3000` after payment.
 * That is a broken
 * checkout caused by an unset environment variable, with no error anywhere.
 * Falling back to the production domain makes the failure mode "a dev machine
 * generates links pointing at production" — visible, harmless, and impossible
 * to lose a sale to.
 *
 * Localhost is still used when it is genuinely correct: `NEXT_PUBLIC_APP_URL`
 * is set to `http://localhost:3000` in a local `.env`, which overrides this.
 */

/** The production domain. Overridden per-deployment by `NEXT_PUBLIC_APP_URL`. */
const PRODUCTION_ORIGIN = "https://www.valkyrie-eg.com";

/**
 * Strip any trailing slash so callers can join with a leading-slash path
 * without producing a double slash. `new URL()` would normalise it, but this
 * value is also concatenated directly in a few places (email templates, the
 * `Sitemap:` line in robots.txt) where it would not.
 */
function normalise(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

/**
 * Absolute origin, no trailing slash. e.g. `https://www.valkyrie-eg.com`.
 */
export const SITE_URL = normalise(
  process.env.NEXT_PUBLIC_APP_URL || PRODUCTION_ORIGIN
);

/**
 * `SITE_URL` as a `URL`, which is what Next's `metadataBase` wants.
 *
 * Built once here rather than per-call, so a malformed `NEXT_PUBLIC_APP_URL`
 * fails at module load — during the build — rather than on the first request
 * that happens to render metadata.
 */
export const SITE_ORIGIN = new URL(SITE_URL);

/**
 * Join a root-relative path onto the canonical origin.
 *
 * Accepts a path with or without its leading slash so call sites do not have
 * to care which convention the surrounding code uses.
 */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}/${path.replace(/^\/+/, "")}`;
}
