/**
 * LegalPage Entity
 *
 * Represents one legal page (returns, terms, privacy, shipping, faq).
 * Content changes always create a new version; history is written by the
 * repository alongside the update.
 */

import { LegalSlug } from "../legal-slugs";

export class LegalPageEntity {
  constructor(
    public readonly id: string,
    public readonly slug: LegalSlug,
    public readonly title: string,
    public readonly bodyMarkdown: string,
    /**
     * Kept as a string end to end. The column is a Postgres `date` with no
     * time component; round-tripping it through a JS Date lets a timezone
     * offset shift the value by a day.
     */
    public readonly effectiveDate: string,
    public readonly version: number,
    public readonly isPublished: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly updatedBy: string | null
  ) {}

  /**
   * Create a copy with new content
   */
  withContent(
    title: string,
    bodyMarkdown: string,
    effectiveDate: string
  ): LegalPageEntity {
    return new LegalPageEntity(
      this.id,
      this.slug,
      title,
      bodyMarkdown,
      effectiveDate,
      this.version,
      this.isPublished,
      this.createdAt,
      this.updatedAt,
      this.updatedBy
    );
  }

  /**
   * Create a copy with a different published flag
   */
  withPublished(isPublished: boolean): LegalPageEntity {
    return new LegalPageEntity(
      this.id,
      this.slug,
      this.title,
      this.bodyMarkdown,
      this.effectiveDate,
      this.version,
      isPublished,
      this.createdAt,
      this.updatedAt,
      this.updatedBy
    );
  }
}
