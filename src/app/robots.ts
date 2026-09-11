import type { MetadataRoute } from "next";
import { SITE_URL, absoluteUrl } from "@/lib/site-url";

/**
 * robots.txt
 *
 * Served at `/robots.txt` by Next's file convention. Static — it reads no
 * request-time API — so it is generated once at build time.
 *
 * ## What is disallowed, and why each one
 *
 * Everything here is either private, per-customer, or an infinite crawl space.
 * None of it would rank, and all of it costs crawl budget that should be spent
 * on product pages.
 *
 * - `/admin` — staff only. Already gated three ways (`proxy.ts`, the layout's
 *   role check, the procedure tier), so this is about not advertising it, not
 *   about access control. Never rely on robots.txt for either.
 * - `/api` — JSON, including the tRPC batch endpoint. Nothing here is a page.
 * - `/account` — one customer's orders, addresses and wishlist. Requires a
 *   session, so a crawler only ever sees a redirect to `/login`, which makes
 *   every one of these a duplicate of the same page.
 * - `/cart`, `/checkout` — session-scoped and empty to a crawler.
 * - `/search` — unbounded query-string space. The classic crawl trap: every
 *   distinct `?q=` is a new URL with near-identical content.
 * - The auth routes — thin forms with nothing to index, and `/reset-password`
 *   and `/verify-email` carry single-use tokens in the URL that have no
 *   business in a search index.
 *
 * Note that a `Disallow` is not a `noindex`: it stops a crawl, but a
 * disallowed URL can still be listed if something links to it. That is fine
 * for all of the above — none of them would be linked from outside — and for
 * anything where it is not, use the `robots` field in that route's metadata.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/account",
        "/cart",
        "/checkout",
        "/search",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
        "/check-email",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    // Names the canonical host, so a crawler that reached the site through a
    // deployment alias (the old `val-store.vercel.app`, or a preview URL)
    // knows which one to index.
    host: SITE_URL,
  };
}
