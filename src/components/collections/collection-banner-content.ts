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

const FALLBACK_IMAGE = "/brand/hero.jpg";

export const BANNER_CONTENT = {
  all: {
    eyebrow: "Premium streetwear essentials",
    title: "All Products",
    description:
      "Explore the full Valkyrie collection — timeless silhouettes, premium fabrics, and modern streetwear essentials.",
    image: "/brand/banner-all.jpg",
  },
  new: {
    eyebrow: "Just landed",
    title: "New Arrivals",
    description: "The latest additions to our premium collection.",
    image: "/brand/banner-new.jpg",
  },
  sale: {
    eyebrow: "Limited time",
    title: "Sale",
    description: "Don't miss out on these limited-time offers.",
    image: "/brand/banner-sale.jpg",
  },
  index: {
    eyebrow: "Curated by Valkyrie",
    title: "Collections",
    description: "Explore our curated collections of premium streetwear.",
    image: "/brand/banner-collections.jpg",
  },
} as const;

export { FALLBACK_IMAGE };
