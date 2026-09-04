/**
 * Resolving a client IP from request headers.
 *
 * Split out of `rate-limiter.ts` so the decision can be unit-tested without
 * an Upstash client — the same reason `variant-stock-registry.ts` and
 * `sales-series.ts` live outside the things that consume them.
 *
 * ## Why this is not just `x-forwarded-for.split(",")[0]`
 *
 * `X-Forwarded-For` grows left to right as a request crosses proxies:
 *
 * ```
 * client -> P1 -> P2 -> app        XFF: "<whatever the client sent>, <client>, <P1>"
 * ```
 *
 * The **leftmost** entry is therefore the one furthest from the server and
 * the one a client writes directly — reading it means any caller can mint a
 * fresh rate-limit bucket per request by rotating a header. The **rightmost**
 * entry is written by the proxy closest to the app, which is the only entry
 * in the chain the app has any reason to believe.
 *
 * So the entry to read is counted from the right, by however many proxies
 * actually sit in front of this deployment (`TRUSTED_PROXY_HOPS`, default 1).
 *
 * Four IP-keyed consumers depend on this: `public.products.search` (its only
 * throttle — an unauthenticated `ILIKE '%…%'` scan), `newsletter.subscribe`
 * (also its only throttle), `auth.signIn` (one of two limits, and the layer
 * that bounds phone-number enumeration), and `api/csp-report`. A spoofable IP
 * costs each of them its per-client budget entirely.
 *
 * ## What changed, and why it is not a behaviour change on Vercel
 *
 * This previously trusted the leftmost value, justified in a comment by "we
 * deploy on Vercel, which overwrites the header." That is very likely true,
 * but the repo pins no deployment target — no `vercel.json`, no `Dockerfile`,
 * no `output: "standalone"` — so the assumption held up four limiters while
 * being recorded nowhere that fails if it stops being true.
 *
 * Because Vercel *overwrites* rather than appends, its chain is a single
 * entry, where leftmost and rightmost are the same value. Reading from the
 * right is therefore identical on Vercel and strictly safer everywhere else.
 */

/** Header set by the platform itself, not carried through from the client. */
const PLATFORM_HEADERS = [
  // Vercel writes this at its edge alongside overwriting `x-forwarded-for`.
  "x-vercel-forwarded-for",
  // Cloudflare.
  "cf-connecting-ip",
] as const;

/**
 * Proxies between the internet and this app.
 *
 * 1 is correct for Vercel, and for a single reverse proxy in front of a
 * self-hosted instance. Raise it if you add another hop; the value is how far
 * from the right of `X-Forwarded-For` the real client sits.
 */
export const DEFAULT_TRUSTED_PROXY_HOPS = 1;

export function trustedProxyHops(
  env: string | undefined = process.env.TRUSTED_PROXY_HOPS
): number {
  const parsed = Number(env);

  // A misconfigured value must not silently widen trust, so anything that is
  // not a positive integer falls back to the default rather than to 0.
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_TRUSTED_PROXY_HOPS;
  }

  return parsed;
}

/**
 * Pick the client entry out of an `X-Forwarded-For` value.
 *
 * Returns null when the header is absent, empty, or shorter than the trusted
 * hop count — a chain with fewer entries than there are proxies in front of
 * us is not a chain we can read a client out of.
 */
export function clientIpFromForwardedFor(
  value: string | null,
  hops: number
): string | null {
  if (!value) return null;

  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (entries.length === 0) return null;

  // With N trusted proxies, the last N entries were written by them, and the
  // one immediately before those is the client they saw.
  const index = entries.length - hops;

  // Fewer entries than trusted hops means the header did not arrive the way
  // the deployment says it should. Refusing to guess is the point: falling
  // back to entries[0] here would restore exactly the value an attacker
  // controls.
  if (index < 0) return null;

  return entries[index] ?? null;
}

/**
 * Best available identity for the caller, for rate-limit keying only.
 *
 * Never use this for authorization — it is an input, and "unknown" is a
 * legitimate result that every caller then shares one budget under.
 */
export function resolveClientIp(
  headers: Headers,
  hops: number = trustedProxyHops()
): string {
  for (const header of PLATFORM_HEADERS) {
    const value = headers.get(header);
    // These are single-value in practice, but Vercel's can carry a chain when
    // a request already had one; the same right-counting rule applies.
    const resolved = clientIpFromForwardedFor(value, hops);
    if (resolved) return resolved;
  }

  const forwarded = clientIpFromForwardedFor(
    headers.get("x-forwarded-for"),
    hops
  );
  if (forwarded) return forwarded;

  // Written by the immediate proxy rather than accumulated, so it is only as
  // trustworthy as that proxy — but it is not a chain a client can extend.
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}
