/**
 * Slug generation
 *
 * One rule for turning a human name into a URL segment, shared by categories
 * and products so the same name cannot produce two different URLs depending on
 * which form you typed it into.
 *
 * The rule that was here before replaced every run of non-alphanumerics with a
 * hyphen, which turned an apostrophe into a word break: "Men's Tee" became
 * "men-s-tee". Apostrophes are removed rather than separated, because they join
 * a word rather than split it. Accents are folded to their base letter for the
 * same reason — "Café" is "cafe", not "caf-".
 */

/** Quote marks that sit inside a word: ASCII ' ` and the typographic ’ ‘ ʼ. */
const INTRA_WORD_QUOTES = /['`\u2018\u2019\u02BC]/g;

/** Combining marks left behind by NFD normalisation. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Convert a display name to a URL-safe slug.
 *
 * Returns an empty string when nothing survives (a name of only punctuation, or
 * of a script with no ASCII form). Callers decide whether that is an error —
 * a live form wants to show nothing, a use case wants to throw.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(INTRA_WORD_QUOTES, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
