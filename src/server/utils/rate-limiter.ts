/**
 * Rate Limiter (Upstash Redis)
 *
 * Distributed rate limiting using Upstash Redis.
 * Works correctly in serverless environments (Vercel) where
 * in-memory state is not shared across function invocations.
 *
 * Falls back to allowing all requests if Upstash is not configured
 * (for local development without Redis).
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { TRPCError } from "@trpc/server";
import {
  createMemoryRateLimiter,
  type MemoryRateLimiter,
} from "./memory-rate-limiter";

/**
 * Whether Upstash Redis is configured.
 * When false, rate limiting is disabled (all requests allowed).
 */
const isConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

/**
 * Create a Redis client if configured, otherwise null.
 */
const redis = isConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

/**
 * A limit, plus somewhere to fall back to when Redis cannot be reached.
 *
 * `limit()` is a network call, and an unreachable Redis makes it throw
 * `TypeError: fetch failed` rather than return a decision. Nothing used to
 * catch that, so the throw escaped as a bodyless 500 — taking down sign-in,
 * search, newsletter signup and review submission the day the Upstash
 * database behind `UPSTASH_*` was deleted and its hostname stopped resolving.
 *
 * The "no Redis at all" path was always handled: without `UPSTASH_*` every
 * limiter is `null` and every check is a no-op, which is what lets local
 * development run without Redis. "Redis configured but unreachable" was the
 * case nobody had written, and it failed in the worst available way — not
 * open, not closed, just a 500.
 */
export type AppRateLimiter = {
  /** Identifies the limiter in logs. */
  name: string;
  upstash: Ratelimit;
  fallback: MemoryRateLimiter;
};

/** Throttles the outage log so one broken Redis cannot flood the logs. */
const OUTAGE_LOG_INTERVAL_MS = 60_000;
const lastLoggedOutageAt = new Map<string, number>();

function createLimiter(
  name: string,
  limit: number,
  windowMs: number
): AppRateLimiter | null {
  if (!redis) return null;

  return {
    name,
    upstash: new Ratelimit({
      redis,
      // Expressed in milliseconds so the shared and fallback limiters cannot
      // drift apart — one number defines both windows.
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: `ratelimit:${name}`,
    }),
    fallback: createMemoryRateLimiter({ limit, windowMs }),
  };
}

const MINUTE = 60_000;

/**
 * Auth rate limiter: 5 attempts per 15-minute sliding window.
 * Protects login, signup, and phone-lookup endpoints from brute-force.
 */
export const authRateLimiter = createLimiter("auth", 5, 15 * MINUTE);

/**
 * Password reset rate limiter: 3 attempts per hour.
 * Prevents inbox spamming and Resend quota abuse.
 */
export const passwordResetRateLimiter = createLimiter(
  "password-reset",
  3,
  60 * MINUTE
);

/**
 * General API rate limiter: 100 requests per minute.
 * Optional safeguard for public endpoints.
 */
export const apiRateLimiter = createLimiter("api", 100, MINUTE);

/**
 * Check rate limit for a given identifier.
 *
 * Allows everything when Upstash is not configured (development). When it is
 * configured but unreachable, falls back to an in-process limiter rather than
 * throwing: see `AppRateLimiter` for why, and `memory-rate-limiter.ts` for
 * what that fallback is and is not worth.
 */
export async function checkRateLimit(
  limiter: AppRateLimiter | null,
  identifier: string
): Promise<{ allowed: boolean; remaining: number; resetInMs: number }> {
  if (!limiter) {
    // Upstash not configured — allow all (development mode)
    return { allowed: true, remaining: Infinity, resetInMs: 0 };
  }

  try {
    const result = await limiter.upstash.limit(identifier);
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetInMs: result.reset - Date.now(),
    };
  } catch (error) {
    const now = Date.now();
    const lastLogged = lastLoggedOutageAt.get(limiter.name) ?? 0;
    if (now - lastLogged >= OUTAGE_LOG_INTERVAL_MS) {
      lastLoggedOutageAt.set(limiter.name, now);
      // Loud, because the shared limit is the real one and this state should
      // not be allowed to persist unnoticed. `fetch failed` here means the
      // REST URL does not resolve or is refusing connections — check that the
      // Upstash database named by `UPSTASH_REDIS_REST_URL` still exists.
      console.error(
        `[RateLimit] Upstash unreachable for "${limiter.name}" — falling back to per-instance limits:`,
        error
      );
    }

    return limiter.fallback.check(identifier);
  }
}

/**
 * Check a limit and reject the call if it is over budget.
 *
 * The check-then-throw pair was written out at every call site, which is how
 * the codebase ended up with `apiRateLimiter` defined and wired to exactly one
 * endpoint: adding a limit looked like more work than it was. This is that
 * pair, once.
 *
 * Silent no-op without UPSTASH_* configured, inherited from `checkRateLimit` —
 * local development is unaffected.
 */
export async function enforceRateLimit(
  limiter: AppRateLimiter | null,
  identifier: string,
  message = "Too many requests. Please try again shortly."
): Promise<void> {
  const { allowed } = await checkRateLimit(limiter, identifier);

  if (!allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message });
  }
}

/**
 * Helper to get client IP from request headers.
 *
 * The resolution rule — platform-issued headers first, then `X-Forwarded-For`
 * counted from the **right** by `TRUSTED_PROXY_HOPS` — lives in
 * `./client-ip`, which is pure and unit-tested. See that file for why the
 * leftmost entry is the one an attacker writes.
 */
export { resolveClientIp as getClientIp } from "./client-ip";
