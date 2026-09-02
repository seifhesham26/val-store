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
          /**
           * Report-only, deliberately.
           *
           * There was no CSP at all. A real one cannot be written blind here:
           * Next injects inline bootstrap scripts, the app talks to Stripe,
           * UploadThing and Upstash, and images come from several hosts — so a
           * policy guessed in one sitting would break the site in production
           * and be reverted rather than fixed.
           *
           * Report-only cannot block anything. Deploy it, watch what the
           * browser console reports over a few days of real traffic, then
           * promote it to `Content-Security-Policy` once the report is quiet.
           *
           * `'unsafe-inline'` on script-src is a placeholder for exactly that
           * reason: removing it needs Next's nonce support wiring through the
           * layout, which is its own change.
           */
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://api.stripe.com https://*.uploadthing.com https://*.ingest.uploadthing.com https://*.upstash.io",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
