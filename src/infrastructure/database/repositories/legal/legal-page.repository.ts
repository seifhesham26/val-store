/**
 * LegalPage Repository Implementation
 *
 * Implements LegalPageRepositoryInterface using Drizzle ORM.
 */

import { db } from "@/db";
import { legalPages, legalPagesHistory } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { LegalSlug } from "@/domain/legal/legal-slugs";
import { LegalPageEntity } from "@/domain/legal/entities/legal-page.entity";
import {
  LegalPageRepositoryInterface,
  UpdateLegalPageInput,
  LegalPageHistoryEntry,
} from "@/domain/legal/interfaces/repositories/legal-page.repository.interface";

export class DrizzleLegalPageRepository implements LegalPageRepositoryInterface {
  /**
   * Find a page by its slug
   */
  async findBySlug(slug: LegalSlug): Promise<LegalPageEntity | null> {
    const page = await db.query.legalPages.findFirst({
      where: eq(legalPages.slug, slug),
    });

    if (!page) return null;
    return this.mapToEntity(page);
  }

  /**
   * Find all legal pages
   */
  async findAll(): Promise<LegalPageEntity[]> {
    const pages = await db.query.legalPages.findMany({
      orderBy: [asc(legalPages.slug)],
    });

    return pages.map((p) => this.mapToEntity(p));
  }

  /**
   * Update a page's content. The previous state is written to history and the
   * version bumped inside one transaction — a history that can lose its
   * predecessor is not a history.
   */
  async update(input: UpdateLegalPageInput): Promise<LegalPageEntity> {
    return db.transaction(async (tx) => {
      const current = await tx.query.legalPages.findFirst({
        where: eq(legalPages.slug, input.slug),
      });
      if (!current) {
        throw new Error(`Legal page not found: ${input.slug}`);
      }

      // Snapshot the state BEFORE the edit, attributed to whoever last wrote it.
      await tx.insert(legalPagesHistory).values({
        pageId: current.id,
        slug: current.slug,
        title: current.title,
        bodyMarkdown: current.bodyMarkdown,
        effectiveDate: current.effectiveDate,
        version: current.version,
        createdBy: current.updatedBy,
      });

      const [updated] = await tx
        .update(legalPages)
        .set({
          title: input.title,
          bodyMarkdown: input.bodyMarkdown,
          effectiveDate: input.effectiveDate,
          isPublished: input.isPublished ?? current.isPublished,
          version: current.version + 1,
          updatedAt: new Date(),
          updatedBy: input.updatedBy,
        })
        .where(eq(legalPages.id, current.id))
        .returning();

      return this.mapToEntity(updated);
    });
  }

  /**
   * List history entries for a slug, oldest version first
   */
  async history(slug: LegalSlug): Promise<LegalPageHistoryEntry[]> {
    const entries = await db.query.legalPagesHistory.findMany({
      where: eq(legalPagesHistory.slug, slug),
      orderBy: [asc(legalPagesHistory.version)],
    });

    return entries.map((e) => ({
      id: e.id,
      slug: e.slug as LegalSlug,
      title: e.title,
      bodyMarkdown: e.bodyMarkdown,
      effectiveDate: e.effectiveDate,
      version: e.version,
      createdAt: new Date(e.createdAt),
      createdBy: e.createdBy,
    }));
  }

  /**
   * Restore a page to a previous version. Routed through `update`, so the
   * revert is itself recorded as a new version rather than silently
   * rewriting the past.
   */
  async revert(
    slug: LegalSlug,
    version: number,
    userId: string
  ): Promise<LegalPageEntity> {
    const entry = await db.query.legalPagesHistory.findFirst({
      where: and(
        eq(legalPagesHistory.slug, slug),
        eq(legalPagesHistory.version, version)
      ),
    });
    if (!entry) {
      throw new Error(`No version ${version} recorded for legal page: ${slug}`);
    }

    return this.update({
      slug,
      title: entry.title,
      bodyMarkdown: entry.bodyMarkdown,
      effectiveDate: entry.effectiveDate,
      updatedBy: userId,
    });
  }

  /**
   * Map database result to entity
   */
  private mapToEntity(dbPage: {
    id: string;
    slug: string;
    title: string;
    bodyMarkdown: string;
    effectiveDate: string;
    version: number;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
    updatedBy: string | null;
  }): LegalPageEntity {
    return new LegalPageEntity(
      dbPage.id,
      dbPage.slug as LegalSlug,
      dbPage.title,
      dbPage.bodyMarkdown,
      // A `date` column comes back as a plain string; keep it that way —
      // constructing a Date here can shift the value by a day.
      dbPage.effectiveDate,
      dbPage.version,
      dbPage.isPublished,
      new Date(dbPage.createdAt),
      new Date(dbPage.updatedAt),
      dbPage.updatedBy
    );
  }
}
