/**
 * What "new" means, in one place.
 *
 * Four parts of the storefront claimed to show new arrivals and no two agreed:
 *
 * - `/collections/new` applied **no filter at all** — the whole catalogue,
 *   byte-identical to `/collections/all`, under a different heading.
 * - The `/collections` index row filtered on `isFeatured`, which is curation,
 *   not recency.
 * - The homepage carousel took `limit: 8` off the default `created_at DESC`
 *   ordering — the only one of the four that was even approximately right.
 * - A `new-arrivals` category existed as a fifth, hand-curated answer, empty
 *   and reachable only by typing its URL.
 *
 * A recency window rather than a curated category, because a category has to
 * be maintained and silently shows nothing when it is not: the "New Arrivals"
 * category currently holds zero products. A window needs no upkeep and is
 * self-correcting — a product added today is new, and stops being new on its
 * own thirty days later.
 *
 * On a store that has just launched this matches everything, and that is the
 * honest answer rather than a bug: a catalogue uploaded last week *is* all new
 * arrivals. It narrows by itself as the catalogue ages.
 */
export const NEW_ARRIVAL_WINDOW_DAYS = 30;
