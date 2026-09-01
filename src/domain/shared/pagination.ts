/**
 * Page-number pagination.
 *
 * The storefront and admin both page by number rather than by cursor, so the
 * same two sums — page to offset, and total to page count — were written out at
 * every call site: the two list use cases, the public products router, the
 * public orders router. Four copies of an off-by-one waiting to happen, and the
 * kind that ships silently because page one always looks right.
 */

export interface PageWindow {
  limit: number;
  offset: number;
}

/**
 * Turn a 1-based page number into a SQL window.
 *
 * Defensive about its inputs because they arrive from query strings: a page
 * below 1 is clamped to the first page rather than producing a negative offset,
 * which Postgres rejects outright.
 */
export function pageWindow(page: number, limit: number): PageWindow {
  const safeLimit = Math.max(1, Math.floor(limit) || 1);
  const safePage = Math.max(1, Math.floor(page) || 1);
  return { limit: safeLimit, offset: (safePage - 1) * safeLimit };
}

/**
 * How many pages a total spans.
 *
 * Zero rows is zero pages, not one: "page 1 of 1" over an empty list invites a
 * pager that offers a page with nothing on it.
 */
export function pageCount(total: number, limit: number): number {
  const safeLimit = Math.max(1, Math.floor(limit) || 1);
  const safeTotal = Math.max(0, Math.floor(total) || 0);
  return Math.ceil(safeTotal / safeLimit);
}
