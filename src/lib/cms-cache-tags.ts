/**
 * The cache tags for CMS content sections, defined once.
 *
 * Read side (`src/lib/cache.ts`) and write side
 * (`src/server/routers/admin/settings/content-sections.ts`) both go through
 * here, because they did not always agree and nothing noticed. The hero was
 * cached under `hero-section` and the announcement under `announcement`, while
 * every save invalidated `cms-hero` and `cms-announcement`. Those tags matched
 * nothing, so an admin edit was picked up only when the 60-second revalidate
 * happened to come round.
 *
 * That is a bug with no symptoms worth reporting — no error, no failed save,
 * and the storefront correct again within a minute — which is exactly why it
 * survived two section types and was found only when a third was added. A
 * shared helper makes the strings impossible to mismatch; two hand-written
 * constants in two files were always going to drift.
 */

import type { SectionTypeKey } from "@/domain/site/value-objects/content-schemas";

/** Invalidated alongside the per-section tag on every content-section write. */
export const CMS_SECTIONS_TAG = "cms-sections";

/** The tag for one section type, e.g. `cms-hero`. */
export function cmsSectionTag(sectionType: SectionTypeKey): string {
  return `cms-${sectionType}`;
}
