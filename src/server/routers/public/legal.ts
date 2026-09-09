/**
 * Public Legal Router
 *
 * Storefront reads of the legal pages. `getBySlug` is a publicProcedure and
 * must stay one: it never calls `ctx.getUser()`, so `touchedAuth()` stays
 * false and `responseMeta` can cache the response publicly. A legal page is
 * the most cacheable thing on the site — putting it behind an auth read
 * would poison the whole HTTP batch it travels in.
 */

import { z } from "zod";
import { router, publicProcedure } from "../../trpc";
import { container } from "@/application/container";
import { LEGAL_SLUGS } from "@/domain/legal/legal-slugs";

export const publicLegalRouter = router({
  /**
   * Get a published legal page by slug, or null when it does not exist so a
   * consumer can fall back rather than 500.
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.enum(LEGAL_SLUGS) }))
    .query(async ({ input }) => {
      const repo = container.getLegalPageRepository();
      const page = await repo.findBySlug(input.slug);
      if (!page || !page.isPublished) {
        return null;
      }
      return page;
    }),
});
