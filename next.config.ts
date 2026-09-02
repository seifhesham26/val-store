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
