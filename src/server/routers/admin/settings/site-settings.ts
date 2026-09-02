import { z } from "zod";
import { revalidateTag } from "next/cache";
import { adminProcedure, adminWriteProcedure } from "../../../trpc";
import { container } from "@/application/container";
import { urlOrAssetPath } from "@/domain/shared/value-objects/url-or-asset-path.schema";

// ============================================
// VALIDATION SCHEMAS
// ============================================

/**
 * Treat an empty string as "not set".
 *
 * The settings forms hold their state as strings and POST every field, so a
 * cleared input arrives as "" — which `.url()` and `.email()` reject. Without
 * this, a store with no contact email could not save the Store tab at all.
 * Normalising to null here fixes it for every caller, not just those two forms.
 */
const emptyToNull = <T extends z.ZodType<string>>(schema: T) =>
  z
    .union([
      // Ordered: a blank/whitespace-only string is matched before the stricter
      // schema gets a chance to reject it.
      z
        .string()
        .regex(/^\s*$/)
        .transform(() => null),
      schema,
      z.null(),
    ])
    .optional();

export const updateSiteSettingsSchema = z.object({
  storeName: z.string().min(1, "Store name is required").optional(),
  storeTagline: emptyToNull(z.string()),
  // Logo and favicon are usually local files under public/, so a bare path is
  // valid here. The social links are genuinely external and stay strict.
  logoUrl: emptyToNull(urlOrAssetPath),
  faviconUrl: emptyToNull(urlOrAssetPath),
  contactEmail: emptyToNull(z.string().email("Must be a valid email address")),
  contactPhone: emptyToNull(z.string()),
  instagramUrl: emptyToNull(z.string().url("Must be a valid URL")),
  facebookUrl: emptyToNull(z.string().url("Must be a valid URL")),
  twitterUrl: emptyToNull(z.string().url("Must be a valid URL")),
  tiktokUrl: emptyToNull(z.string().url("Must be a valid URL")),
  currency: z.string().length(3).optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  defaultMetaTitle: emptyToNull(z.string()),
  defaultMetaDescription: emptyToNull(z.string()),
});

// ============================================
// PROCEDURES
// ============================================

export const siteSettingsProcedures = {
  getSiteSettings: adminProcedure.query(async () => {
    const repo = container.getSiteConfigRepository();
    const settings = await repo.getSiteSettings();
    if (!settings) {
      return (await repo.initializeSiteSettings()).toObject();
    }
    return settings.toObject();
  }),

  updateSiteSettings: adminWriteProcedure
    .input(updateSiteSettingsSchema)
    .mutation(async ({ input, ctx }) => {
      const repo = container.getSiteConfigRepository();
      const updated = await repo.updateSiteSettings(input, ctx.user.id);

      // The footer reads these through `unstable_cache` on every page, so a
      // save is invisible for up to a minute unless the tag is dropped.
      revalidateTag("site-settings", "max");

      return updated.toObject();
    }),
};
