import type { NextConfig } from "next";
import { REMOTE_IMAGE_HOSTS } from "./src/lib/image-hosts";

const nextConfig: NextConfig = {
  reactCompiler: true,

  images: {
    // Every host the app may render. `OPTIMIZED_IMAGE_HOSTS` in that same file
    // is the narrower list the components consult to decide whether a given URL
    // goes through the optimiser at all — see it for why picsum is excluded.
    remotePatterns: REMOTE_IMAGE_HOSTS.map((hostname) => ({
      protocol: "https" as const,
      hostname,
    })),
    // AVIF first; it is materially smaller than WebP for photographic product
    // shots, which is nearly everything on this site.
    formats: ["image/avif", "image/webp"],
    // A product image is immutable once uploaded — the URL changes when the
    // image does — so there is no reason to re-optimise it every 60 seconds.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  // Security headers
  async headers() {
    /**
     * The policy, as one list, used twice.
     *
     * It is split rather than shipped whole because the two halves are at very
     * different stages. Everything in ENFORCED is known not to break this app —
     * nothing embeds it, nothing sets a `<base>`, nothing loads a plugin, and
     * every form posts to its own origin — so leaving those unenforced bought
     * nothing. `script-src`/`style-src` are the genuinely uncertain ones: Next
     * injects inline bootstrap scripts, so tightening them needs nonce support
     * wired through the layout, and a policy guessed in one sitting would break
     * production and be reverted rather than fixed.
     *
     * Previously the whole thing was report-only *and* had no reporting
     * endpoint, which is the one configuration that does nothing at all: it
     * blocks nothing and records nothing. `/api/csp-report` now collects the
     * violations, so promoting the rest is a matter of reading the logs rather
     * than guessing.
     *
     * ---------------------------------------------------------------------
     * Why `script-src` is still not enforced — measured 2026-09-03, so nobody
     * re-litigates it from first principles.
     *
     * Next documents two ways to drop `'unsafe-inline'`, and neither works
     * here:
     *
     * 1. **Nonces.** Next's own guide is explicit that nonces require every
     *    page to be dynamically rendered — "Static optimization and ISR are
     *    disabled", "Pages cannot be cached by CDNs". This app prerenders 98
     *    pages, and `docs/PERFORMANCE.md` records two passes whose whole point
     *    was getting collection pages prerendered with `generateStaticParams`.
     *    Nonces would undo all of it and put a server render in front of every
     *    storefront visitor.
     *
     * 2. **Experimental SRI** (`experimental.sri`), which the guide offers as
     *    the static-friendly alternative. Tried it: it does add
     *    `integrity="sha256-…"` to external chunks, but the built HTML still
     *    contains **8 inline `<script>` blocks per page** with no hash and no
     *    integrity — Next's own bootstrap and flight data. Enforcing
     *    `script-src 'self'` would block them and break hydration everywhere.
     *    SRI covers external scripts only, whatever the guide's example
     *    implies.
     *
     * So `'unsafe-inline'` stays until Next can hash its inline bootstrap, and
     * the honest position is that CSP is not currently protecting this app
     * against script injection. What *is* worth doing, and needs production
     * evidence rather than a guess: promote `connect-src`, `img-src`,
     * `font-src` and `frame-src` from the reported half. They constrain where
     * an injected script could send data, which is real defence even while
     * `script-src` is permissive. Read `/api/csp-report` logs for a week
     * first — a missed host in `connect-src` breaks checkout.
     * ---------------------------------------------------------------------
     */
    const ENFORCED = [
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ];

    const REPORTED = [
      "default-src 'self'",
      // `'unsafe-inline'`/`'unsafe-eval'` are placeholders — the reason this
      // half is not enforced. Remove them once nonces are wired through.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://api.stripe.com https://*.uploadthing.com https://*.ingest.uploadthing.com https://*.upstash.io",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      ...ENFORCED,
      "report-uri /api/csp-report",
      "report-to csp",
    ];

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // The modern reporting channel. `report-uri` above is the legacy one
          // and is kept because browser support for the two still differs.
          {
            key: "Reporting-Endpoints",
            value: 'csp="/api/csp-report"',
          },
          {
            key: "Content-Security-Policy",
            value: ENFORCED.join("; "),
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value: REPORTED.join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
