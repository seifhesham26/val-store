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
 * Auth rate limiter: 5 attempts per 15-minute sliding window.
 * Protects login, signup, and phone-lookup endpoints from brute-force.
 */
export const authRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      prefix: "ratelimit:auth",
    })
  : null;

/**
 * Password reset rate limiter: 3 attempts per hour.
 * Prevents inbox spamming and Resend quota abuse.
 */
export const passwordResetRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 h"),
      prefix: "ratelimit:password-reset",
    })
  : null;

/**
 * General API rate limiter: 100 requests per minute.
 * Optional safeguard for public endpoints.
 */
export const apiRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"),
      prefix: "ratelimit:api",
    })
  : null;

/**
 * Check rate limit for a given identifier.
 * Returns { allowed, remaining, resetIn } or allows all if Upstash is not configured.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ allowed: boolean; remaining: number; resetInMs: number }> {
  if (!limiter) {
    // Upstash not configured — allow all (development mode)
    return { allowed: true, remaining: Infinity, resetInMs: 0 };
  }

  const result = await limiter.limit(identifier);
  return {
    allowed: result.success,
    remaining: result.remaining,
    resetInMs: result.reset - Date.now(),
  };
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
  limiter: Ratelimit | null,
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
 */
export function getClientIp(headers: Headers): string {
  // Check common proxy headers
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback
  return "unknown";
}
