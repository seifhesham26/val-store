import { describe, it, expect } from "vitest";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  RESERVED_COLLECTION_SLUGS,
  isReservedCollectionSlug,
} from "./reserved-slugs";

/**
 * The half of the rule that no runtime check can enforce.
 *
 * `isReservedCollectionSlug` stops an admin creating a category that a static
 * route would hide. Nothing stops a *developer* adding a static route that
 * hides a category that already exists — which is exactly how
 * `/collections/men`, `/collections/women`, `/collections/accessories` and
 * `/collections/sale` came to serve something other than the categories of the
 * same name. This asserts the route directory against the list.
 */
const COLLECTIONS_DIR = join(
  process.cwd(),
  "src",
  "app",
  "(main)",
  "collections"
);

/** Static route segments under /collections, excluding the dynamic one. */
function staticCollectionSegments(): string[] {
  return (
    readdirSync(COLLECTIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      // `[slug]` is the dynamic route these would shadow, not a shadower.
      .filter((entry) => !entry.name.startsWith("["))
      // A directory only claims a URL once it has a page.
      .filter((entry) =>
        existsSync(join(COLLECTIONS_DIR, entry.name, "page.tsx"))
      )
      .map((entry) => entry.name)
  );
}

describe("reserved collection slugs", () => {
  it("matches case-insensitively — slugs arrive from a form", () => {
    expect(isReservedCollectionSlug("SALE")).toBe(true);
    expect(isReservedCollectionSlug("sale")).toBe(true);
  });

  it("does not reserve a slug that merely contains a reserved one", () => {
    expect(isReservedCollectionSlug("sale-2026")).toBe(false);
    expect(isReservedCollectionSlug("all-weather")).toBe(false);
  });

  it("leaves real category slugs alone", () => {
    for (const slug of ["men", "women", "accessories", "new-arrivals"]) {
      expect(isReservedCollectionSlug(slug)).toBe(false);
    }
  });

  it("every static /collections route is declared reserved", () => {
    // Fails when someone adds `src/app/(main)/collections/<x>/page.tsx`
    // without reserving `<x>`. Either reserve it, or — usually the right
    // answer — let `[slug]` serve the category instead.
    for (const segment of staticCollectionSegments()) {
      expect(
        isReservedCollectionSlug(segment),
        `/collections/${segment} is a static route but "${segment}" is not in ` +
          `RESERVED_COLLECTION_SLUGS, so it silently shadows any category ` +
          `with that slug`
      ).toBe(true);
    }
  });

  it("the three category-shadowing routes are gone", () => {
    // `men`, `women` and `accessories` are real categories, so `[slug]` serves
    // them. `new` is deliberately NOT in this list: it is a recency filter
    // (`NEW_ARRIVAL_WINDOW_DAYS`), which no `categories` row can express, so it
    // stays a static route — and stays reserved because of it.
    const segments = staticCollectionSegments();
    for (const removed of ["men", "women", "accessories"]) {
      expect(segments).not.toContain(removed);
    }
  });

  it("reserves nothing it does not have a route for", () => {
    // Keeps the list honest in the other direction: a slug reserved after its
    // route was deleted would block an admin from a name nothing is using.
    const segments = new Set(staticCollectionSegments());
    for (const slug of RESERVED_COLLECTION_SLUGS) {
      expect(
        segments,
        `"${slug}" is reserved but has no static route`
      ).toContain(slug);
    }
  });
});
