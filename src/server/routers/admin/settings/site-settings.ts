import { z } from "zod";
import { adminProcedure } from "../../../trpc";
import { container } from "@/application/container";

// ============================================
// VALIDATION SCHEMAS
// ============================================

export const updateSiteSettingsSchema = z.object({
  storeName: z.string().min(1).optional(),
  storeTagline: z.string().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  faviconUrl: z.string().url().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  instagramUrl: z.string().url().nullable().optional(),
  facebookUrl: z.string().url().nullable().optional(),
  twitterUrl: z.string().url().nullable().optional(),
  tiktokUrl: z.string().url().nullable().optional(),
  currency: z.string().length(3).optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
  defaultMetaTitle: z.string().nullable().optional(),
  defaultMetaDescription: z.string().nullable().optional(),
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

  updateSiteSettings: adminProcedure
    .input(updateSiteSettingsSchema)
    .mutation(async ({ input, ctx }) => {
      const repo = container.getSiteConfigRepository();
      const updated = await repo.updateSiteSettings(input, ctx.user.id);
      return updated.toObject();
    }),
};
