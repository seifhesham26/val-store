/**
 * Legal Pages Admin Router
 *
 * tRPC endpoints for managing the legal pages (returns, terms, privacy,
 * shipping, faq). Reads are open to every admin-area role including the
 * read-only worker; writes (update, revert) are admin/super_admin only.
 */

import { z } from "zod";
import { router, adminProcedure, adminWriteProcedure } from "../../trpc";
import { container } from "@/application/container";
import { LEGAL_SLUGS } from "@/domain/legal/legal-slugs";
import { revalidateTag } from "next/cache";

const slugSchema = z.enum(LEGAL_SLUGS);

export const legalRouter = router({
  /**
   * List all legal pages
   */
  list: adminProcedure.query(async () => {
    const repo = container.getLegalPageRepository();
    return repo.findAll();
  }),

  /**
   * Get one legal page by slug, or null if it has never been written
   */
  get: adminProcedure
    .input(z.object({ slug: slugSchema }))
    .query(async ({ input }) => {
      const repo = container.getLegalPageRepository();
      return repo.findBySlug(input.slug);
    }),

  /**
   * Version history for a slug, oldest version first
   */
  history: adminProcedure
    .input(z.object({ slug: slugSchema }))
    .query(async ({ input }) => {
      const repo = container.getLegalPageRepository();
      return repo.history(input.slug);
    }),

  /**
   * Update a page's content. The repository records the previous state as a
   * history row in the same transaction.
   */
  update: adminWriteProcedure
    .input(
      z.object({
        slug: slugSchema,
        title: z.string(),
        bodyMarkdown: z.string(),
        effectiveDate: z.string(),
        isPublished: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const useCase = container.getUpdateLegalPageUseCase();
      const updated = await useCase.execute({
        ...input,
        updatedBy: ctx.user.id,
      });

      // The storefront reads legal pages through cached fetchers; without
      // this the old policy keeps serving until the TTL expires.
      revalidateTag(`legal-${input.slug}`, "max");

      return updated;
    }),

  /**
   * Restore a page to a previous version. Routed through the repository's
   * update path, so the revert is itself recorded as a new version.
   */
  revert: adminWriteProcedure
    .input(
      z.object({
        slug: slugSchema,
        version: z.number().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const repo = container.getLegalPageRepository();
      const reverted = await repo.revert(
        input.slug,
        input.version,
        ctx.user.id
      );

      // Same tag `update` invalidates — a revert is a write like any other.
      revalidateTag(`legal-${input.slug}`, "max");

      return reverted;
    }),
});
