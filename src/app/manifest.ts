import type { MetadataRoute } from "next";

/**
 * Web app manifest, served at `/manifest.webmanifest`.
 *
 * This is what makes "Add to Home Screen" produce a branded launcher entry
 * rather than a screenshot of the page with the URL under it — which matters
 * here more than it would elsewhere, because the target market is Egypt and
 * the traffic is overwhelmingly mobile.
 *
 * Static by design: no request-time API, so it is generated at build time.
 * Deliberately not read from `site_settings` for the same reason — a manifest
 * is fetched once and cached hard by the OS, so making it dynamic would buy an
 * editable field that almost never takes effect.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Valkyrie",
    short_name: "Valkyrie",
    description: "Premium streetwear, built for those who move first.",
    start_url: "/",
    display: "standalone",
    // Both are the storefront's true background. `theme_color` tints the
    // Android status bar and the desktop PWA title bar; a mismatch here is
    // what produces the thin bright strip above a dark app.
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait",
    categories: ["shopping", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Android crops this one to the launcher's own shape — a circle, a
      // squircle, a rounded square — and only guarantees the middle 80%
      // survives. It is generated with much heavier padding for that reason;
      // without a `maskable` entry the launcher letterboxes the `any` icon
      // inside a white rounded square instead.
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
