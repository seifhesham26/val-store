/**
 * SQL LIKE / ILIKE pattern building.
 *
 * `%` and `_` are wildcards inside a LIKE pattern, so a search term containing
 * either has to be escaped before it is wrapped in `%…%`. Without this, a
 * customer searching for "50%" gets a pattern of `%50%%` — which matches every
 * row in the table — and searching "t_e" matches "tee", "the" and "toe".
 *
 * Lives in the domain because it is a rule about interpreting user input, not
 * about Drizzle. The repository pairs the returned pattern with
 * `ESCAPE '\'`.
 */

/** The escape character the pattern is built for. Must match the SQL `ESCAPE`. */
export const LIKE_ESCAPE_CHAR = "\\";

/**
 * Escape the LIKE metacharacters in a raw term.
 *
 * The backslash itself is escaped first — doing it last would double-escape the
 * backslashes this function had just introduced.
 */
export function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `${LIKE_ESCAPE_CHAR}${char}`);
}

/**
 * Build a "contains" pattern for a raw, untrusted search term.
 *
 * Returns null when the term is only whitespace — there is no useful pattern
 * for that, and `%%` would match everything. Callers treat null as "no search
 * filter", which is different from "a search that matches nothing".
 */
export function containsPattern(term: string | null | undefined): string | null {
  const trimmed = term?.trim();
  if (!trimmed) return null;
  return `%${escapeLikeTerm(trimmed)}%`;
}
