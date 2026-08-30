import { z } from "zod";

/** True only for an absolute http(s) URL. */
function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * A full http(s) URL, or a site-relative asset path such as
 * `/logo/VAL-LOGO.png`.
 *
 * Assets served out of `public/` are the normal case for logos, favicons and
 * section imagery, and `z.string().url()` rejects them outright. That made the
 * Appearance tab impossible to save on any seeded database, because the seed
 * writes exactly such a path into `site_settings.logo_url` — the form loaded it
 * back and resubmitted a value its own schema refused.
 *
 * Protocol-relative values (`//example.com/x`) are rejected on purpose: they
 * read as local but load from a third party.
 */
export const urlOrAssetPath = z
  .string()
  .refine((value) => isAbsoluteHttpUrl(value) || /^\/(?!\/)\S*$/.test(value), {
    message: "Must be a full URL (https://…) or a path starting with /",
  });
