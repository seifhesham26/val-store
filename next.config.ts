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
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
