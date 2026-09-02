/**
 * Two questions about a URL that arrived from outside, and the answers.
 *
 * Both are here rather than in separate files because they share one piece of
 * machinery — resolving a candidate against a sentinel origin to find out
 * whether it is really relative — and differ only in what they allow once that
 * is known. Keeping them apart invited one to be fixed and the other missed.
 *
 * The inputs they defend against are the ones where a browser and a plausible
 * hand-written check disagree:
 *
 *   - `//evil.example` is protocol-relative and loads a third party.
 *   - `/\evil.example` is the same thing — for a special scheme the URL parser
 *     treats a backslash as a slash, so this reaches the authority state too.
 *   - `/%09/evil.example` and friends smuggle tab/newline characters, which
 *     the parser strips *before* parsing, turning them back into the first
 *     case after any naive check has already passed.
 *
 * Delegating to the URL parser catches all three without enumerating them,
 * because each resolves to an origin that is not the sentinel.
 */

/**
 * A base that cannot collide with anything real.
 *
 * `.invalid` is reserved by RFC 2606 and can never be registered, so a value
 * that resolves to this origin is guaranteed to have been relative — which is
 * exactly the test being made.
 */
const SENTINEL_ORIGIN = "https://safe-url.invalid";

/** Where to send someone when a requested destination is not allowed. */
export const DEFAULT_REDIRECT = "/";

/**
 * The same-origin path a value denotes, or null if it does not denote one.
 *
 * The explicit leading-slash check in front of the parse is not redundant with
 * the origin comparison: it rejects a bare `evil.example` (which would
 * otherwise resolve to a same-origin *path* of `/evil.example`) and anything
 * with leading whitespace, so what comes back is always recognisably the shape
 * it was given.
 */
function relativePath(value: string): string | null {
  if (!value.startsWith("/")) return null;

  try {
    const url = new URL(value, SENTINEL_ORIGIN);
    if (url.origin !== SENTINEL_ORIGIN) return null;

    // Rebuilt from the parsed URL rather than returned as given, so the caller
    // uses the thing that was actually validated.
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * Where a post-authentication redirect is allowed to send someone.
 *
 * The login and signup forms take their destination from `?redirect=`, which
 * `src/proxy.ts` writes itself when it bounces an anonymous visitor off an
 * admin route — so the parameter is a normal part of the app's own URLs and
 * looks entirely legitimate. It was being handed to `router.push` unchecked,
 * and `router.push` performs a hard navigation for anything off-origin. That
 * makes `/login?redirect=https://evil.example` a redirect off the site at the
 * one moment a person has just proven they trust it and typed a password.
 *
 * Only a same-origin path is allowed through. Absolute URLs are rejected even
 * when they point back at this site: the server has no reliable way to know
 * its own public origin (proxies, preview deployments, custom domains), so "is
 * this URL us?" is a question with no trustworthy answer, while "is this a
 * path?" has an exact one.
 */
export function safeRedirect(
  value: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT
): string {
  if (!value) return fallback;
  return relativePath(value) ?? fallback;
}

/**
 * A URL that is safe to put in an `href`, or null if there isn't one.
 *
 * Looser than `safeRedirect` in one direction and stricter in another. An
 * absolute `http(s)` URL is allowed, because a CMS link legitimately points
 * off-site — a lookbook, a campaign page, a partner. Every other scheme is
 * refused, and that is the point: `javascript:` in an `href` executes, React
 * does not stop it, and the CMS fields feeding these are stored strings that
 * reach every visitor's page.
 *
 * Returns null rather than a fallback so the caller can choose between
 * substituting a default (the hero's CTA needs *a* destination) and rendering
 * no link at all (an announcement without a link is just text).
 *
 * This is the second of two checks, not the only one: `ctaLink` and the
 * announcement's `link` are validated on write by `urlOrAssetPath` in their
 * Zod schemas. It exists because the render path in `ServerHeroSection` and
 * `AnnouncementBarClient` reads `JSON.parse(section.content)` and spreads it
 * without re-validating, so any row written before those schemas were
 * tightened — or by anything that bypasses them — still arrives here.
 */
export function safeHref(value: string | null | undefined): string | null {
  if (!value) return null;

  // Relative first: `//evil.example` and `/\evil.example` start with a slash
  // and must be judged as paths, not handed to the absolute branch.
  if (value.startsWith("/")) {
    return relativePath(value);
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}
