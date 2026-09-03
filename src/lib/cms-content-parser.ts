/**
 * Validate JSON content read back from `content_sections` against the same
 * Zod schema the write path enforces (`heroContentSchema` /
 * `announcementContentSchema` in `content-schemas.ts`).
 *
 * The read path used to be a bare `JSON.parse` plus a force-cast in
 * `cache.ts`, so a row written by hand, a migration, or a schema change
 * surfaced as `undefined` fields rendered straight into the page — the
 * validator existed but only the write path called it. Malformed JSON and a
 * schema-invalid shape both degrade to `null` here, the same "nothing to
 * render" signal `getContentSection` already returns for a missing row, so
 * `ServerHeroSection` / `ServerAnnouncementBar` fall back to their hardcoded
 * defaults exactly as they do for a database failure, rather than crashing.
 *
 * Pure and dependency-free on purpose (no `container`, no `@/db`) so it is
 * unit-testable without a database — see `cms-content-parser.test.ts`.
 */
export function parseSectionContent<T>(
  label: string,
  raw: string,
  parse: (content: unknown) => T
): T | null {
  try {
    return parse(JSON.parse(raw));
  } catch (error) {
    console.error(`[cms-content] Invalid ${label} content:`, error);
    return null;
  }
}
