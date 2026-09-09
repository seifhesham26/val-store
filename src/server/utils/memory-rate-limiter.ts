/**
 * In-process sliding-window rate limiter.
 *
 * This exists to be the fallback when Upstash cannot be reached. It is
 * deliberately not a replacement for it: state lives in one process, so on
 * Vercel each invocation gets its own budget and the effective limit is
 * `limit × instances`. That is a much weaker guarantee than the shared
 * counter, and it is still enormously better than the two alternatives during
 * an outage — no limit at all, or a hard failure on the sign-in path.
 *
 * The failure that motivated it: the Upstash database behind `UPSTASH_*` was
 * deleted, its hostname stopped resolving, and every `limiter.limit()` threw
 * `TypeError: fetch failed`. Nothing caught it, so `auth.signIn`,
 * `products.search`, `newsletter.subscribe` and `reviews.create` all returned
 * a bodyless 500. `rate-limiter.ts` no-ops cleanly when `UPSTASH_*` is unset,
 * so the "no Redis" path was well handled — "Redis configured but unreachable"
 * was the one nobody had written.
 *
 * Kept as a pure module with an injectable clock for the same reason
 * `client-ip.ts` and `response-cache-policy.ts` are: the logic is worth
 * testing and none of it needs a network.
 */

export type MemoryRateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** How long until the oldest recorded hit ages out. Zero when under budget. */
  resetInMs: number;
};

export type MemoryRateLimiter = {
  check(identifier: string): MemoryRateLimitResult;
  /** Number of identifiers currently tracked. Exposed for tests. */
  size(): number;
};

export type MemoryRateLimiterOptions = {
  limit: number;
  windowMs: number;
  /**
   * Upper bound on tracked identifiers.
   *
   * The keys are attacker-chosen on public endpoints — an IP, an email
   * address — so the map must not grow with traffic. When full, the least
   * recently seen identifier is evicted. Eviction can only forget hits, which
   * loosens the limit for whoever was evicted; it can never cause a wrong
   * rejection for someone else.
   */
  maxTrackedIdentifiers?: number;
  now?: () => number;
};

const DEFAULT_MAX_TRACKED_IDENTIFIERS = 10_000;

export function createMemoryRateLimiter({
  limit,
  windowMs,
  maxTrackedIdentifiers = DEFAULT_MAX_TRACKED_IDENTIFIERS,
  now = Date.now,
}: MemoryRateLimiterOptions): MemoryRateLimiter {
  // A Map iterates in insertion order, which is what makes "delete then set"
  // on every touch a working LRU without a second data structure.
  const hits = new Map<string, number[]>();

  /** Drop timestamps that have aged out, and the entry itself once empty. */
  const prune = (identifier: string, cutoff: number): number[] => {
    const timestamps = hits.get(identifier);
    if (!timestamps) return [];

    // Timestamps are appended in order, so everything still inside the window
    // is a suffix — find where it starts rather than filtering the whole list.
    let firstLive = 0;
    while (firstLive < timestamps.length && timestamps[firstLive]! <= cutoff) {
      firstLive++;
    }

    const live = firstLive === 0 ? timestamps : timestamps.slice(firstLive);
    if (live.length === 0) {
      hits.delete(identifier);
      return [];
    }

    hits.set(identifier, live);
    return live;
  };

  return {
    check(identifier) {
      const current = now();
      const cutoff = current - windowMs;

      // Sweep a couple of other entries per call so an idle process does not
      // retain every identifier it has ever seen. Bounded work per request.
      for (const other of hits.keys()) {
        if (other === identifier) continue;
        prune(other, cutoff);
        break;
      }

      const live = prune(identifier, cutoff);

      if (live.length >= limit) {
        // Deliberately not recording this attempt. Charging a rejected
        // request would let a client hammering while blocked keep pushing its
        // own reset out, so a burst that then went quiet for a full window
        // still could not get back in.
        //
        // Its LRU position *is* refreshed, though. An identifier being
        // actively rejected is the last one that should be evicted for space:
        // forgetting it is precisely what hands an attacker a fresh budget.
        hits.delete(identifier);
        hits.set(identifier, live);

        const oldest = live[0]!;
        return {
          allowed: false,
          remaining: 0,
          resetInMs: Math.max(0, oldest + windowMs - current),
        };
      }

      live.push(current);
      // Re-inserting moves this identifier to the end of the iteration order,
      // which is what keeps eviction below least-recently-used.
      hits.delete(identifier);
      hits.set(identifier, live);

      if (hits.size > maxTrackedIdentifiers) {
        const oldestIdentifier = hits.keys().next().value;
        if (oldestIdentifier !== undefined) hits.delete(oldestIdentifier);
      }

      return {
        allowed: true,
        remaining: limit - live.length,
        resetInMs: Math.max(0, live[0]! + windowMs - current),
      };
    },

    size() {
      return hits.size;
    },
  };
}
