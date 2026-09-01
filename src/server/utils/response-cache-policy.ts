/**
 * Whether a tRPC HTTP response may be cached by a shared cache.
 *
 * This is pulled out of the route handler and made pure because getting it
 * wrong has a specific, bad consequence: `httpBatchLink` puts several procedure
 * calls into ONE HTTP response, so a response that is cached publicly is served
 * to every subsequent visitor. If it contained one customer's cart, that is who
 * else would see it.
 *
 * The rule is therefore built to fail closed. Only a response that satisfies
 * every condition is shareable; everything else — including anything
 * unrecognised — is `no-store`.
 */

/** Seconds a shared cache may serve a catalogue response. */
export const CACHE_SECONDS = 60;

/** Seconds it may keep serving a stale one while revalidating behind it. */
export const STALE_WHILE_REVALIDATE_SECONDS = 300;

export const PUBLIC_CACHE_CONTROL = `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`;

export const PRIVATE_CACHE_CONTROL = "no-store";

export interface ResponseCacheInput {
  /**
   * Whether anything in this request resolved the signed-in user.
   *
   * This is the load-bearing condition, and it is deliberately stronger than
   * "the user was null". `protectedProcedure` and `adminProcedure` always
   * resolve the user, so `false` means the batch was entirely public
   * procedures. A response that never looked at who was asking cannot vary by
   * who was asking.
   */
  touchedAuth: boolean;
  /** tRPC's operation type for the batch. Only `"query"` is ever cacheable. */
  type: string;
  /** How many operations in the batch errored. */
  errorCount: number;
  /** How many procedures the request actually resolved to. */
  pathCount: number;
}

/**
 * The `Cache-Control` value for a response.
 *
 * Returns the shared-cache header only when all of the following hold, and
 * `no-store` otherwise:
 *
 *   - nothing in the batch resolved the user
 *   - every operation is a query (a mutation is never cacheable)
 *   - nothing errored (an error must not be cached and replayed)
 *   - the request resolved to at least one procedure
 */
export function cacheControlFor(input: ResponseCacheInput): string {
  const shareable =
    input.touchedAuth === false &&
    input.type === "query" &&
    input.errorCount === 0 &&
    input.pathCount > 0;

  return shareable ? PUBLIC_CACHE_CONTROL : PRIVATE_CACHE_CONTROL;
}

/** Convenience predicate, for readability at call sites and in tests. */
export function isPubliclyCacheable(input: ResponseCacheInput): boolean {
  return cacheControlFor(input) === PUBLIC_CACHE_CONTROL;
}
