/**
 * Per-route banner copy and artwork.
 *
 * `/collections/[slug]` is deliberately absent — a category banner is built
 * from the category's own name and description, so renaming it in the admin
 * renames it here too.
 *
 * Images fall back to the existing hero until the campaign shots land, so a
 * missing file never renders a broken banner.
 */

import fs from "node:fs";
import path from "node:path";

const FALLBACK_IMAGE = "/brand/hero.png";

/**
 * Resolve a banner image, falling back when the campaign shot has not landed.
 *
 * The `banner-*.jpg` files are generated separately from the code. Pointing at
 * one that does not exist yet renders a black void across the banner's image
 * panel — the precise dead space this banner replaced. Falling back keeps every
 * collection page looking finished until the real photography arrives, and
 * dropping the files into `public/brand/` then requires no code change.
 *
 * Server-only: this module is imported exclusively by the collection route
 * server components. Do not import it from a client component.
 */
function resolveImage(publicPath: string): string {
  try {
    return fs.existsSync(path.join(process.cwd(), "public", publicPath))
      ? publicPath
      : FALLBACK_IMAGE;
  } catch {
    return FALLBACK_IMAGE;
  }
}

export const BANNER_CONTENT = {
  all: {
    eyebrow: "Premium streetwear essentials",
    title: "All Products",
    description:
      "Explore the full Valkyrie collection — timeless silhouettes, premium fabrics, and modern streetwear essentials.",
    image: resolveImage("/brand/banner-all.jpg"),
  },
  new: {
    eyebrow: "Just landed",
    title: "New Arrivals",
    description: "The latest additions to our premium collection.",
    image: resolveImage("/brand/banner-new.jpg"),
  },
  sale: {
    eyebrow: "Limited time",
    title: "Sale",
    description: "Don't miss out on these limited-time offers.",
    image: resolveImage("/brand/banner-sale.jpg"),
  },
  index: {
    eyebrow: "Curated by Valkyrie",
    title: "Collections",
    description: "Explore our curated collections of premium streetwear.",
    image: resolveImage("/brand/banner-collections.jpg"),
  },
};

export { FALLBACK_IMAGE, resolveImage };
