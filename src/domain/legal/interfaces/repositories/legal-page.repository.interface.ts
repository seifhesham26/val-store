/**
 * LegalPage Repository Interface
 *
 * Defines the contract for legal page data operations.
 */

import { LegalSlug } from "@/domain/legal/legal-slugs";
import { LegalPageEntity } from "@/domain/legal/entities/legal-page.entity";

export interface UpdateLegalPageInput {
  slug: LegalSlug;
  title: string;
  bodyMarkdown: string;
  effectiveDate: string;
  /** Omitted preserves the current flag (revert restores content only). */
  isPublished?: boolean;
  updatedBy: string | null;
}

export interface LegalPageHistoryEntry {
  id: string;
  slug: LegalSlug;
  title: string;
  bodyMarkdown: string;
  effectiveDate: string;
  version: number;
  createdAt: Date;
  createdBy: string | null;
}

export interface LegalPageRepositoryInterface {
  /**
   * Find a page by its slug
   */
  findBySlug(slug: LegalSlug): Promise<LegalPageEntity | null>;

  /**
   * Find all legal pages
   */
  findAll(): Promise<LegalPageEntity[]>;

  /**
   * Update a page's content. The repository records the previous state as a
   * history row and bumps `version` in the same transaction.
   */
  update(input: UpdateLegalPageInput): Promise<LegalPageEntity>;

  /**
   * List history entries for a slug, oldest version first
   */
  history(slug: LegalSlug): Promise<LegalPageHistoryEntry[]>;

  /**
   * Restore a page to a previous version. Routed through `update`, so the
   * revert is itself recorded as a new version.
   */
  revert(
    slug: LegalSlug,
    version: number,
    userId: string
  ): Promise<LegalPageEntity>;
}
