/**
 * The closed set of legal pages.
 *
 * One list, read by the route, the seed, the admin editor and the tRPC input
 * schemas, so a page cannot exist in one of those and not the others.
 * Lives in `domain/` because it has zero dependencies and both server and
 * client code needs it.
 */
export const LEGAL_SLUGS = [
  "returns",
  "terms",
  "privacy",
  "shipping",
  "faq",
] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}
