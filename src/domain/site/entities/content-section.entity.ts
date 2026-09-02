/**
 * Content Section Entity
 *
 * Represents a customizable content section (hero, announcements, etc).
 * Content is stored as JSON string, validated by Zod schemas.
 */

// `promo_banner`, `brand_story`, `newsletter` and `instagram` were removed
// (ISSUES.md #29) — see `content-schemas.ts` for why.
export type SectionType = "hero" | "announcement";

export interface ContentSectionProps {
  id: string;
  sectionType: string;
  content: string; // JSON stringified
  displayOrder: number;
  isActive: boolean;
  version: number;
  updatedAt: Date;
  updatedBy?: string | null;
}

export interface ContentSectionHistoryProps {
  id: string;
  sectionId: string;
  sectionType: string;
  content: string;
  version: number;
  createdAt: Date;
  createdBy?: string | null;
  // Resolved by the repository via a join against `user`, same pattern as
  // inventory logs' `createdByName` — the admin id alone is not worth
  // showing next to a revert button. Optional/absent if the join wasn't run.
  createdByName?: string | null;
}

export class ContentSectionEntity {
  private constructor(private readonly props: ContentSectionProps) {}

  static create(props: ContentSectionProps): ContentSectionEntity {
    return new ContentSectionEntity(props);
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get sectionType(): string {
    return this.props.sectionType;
  }

  get content(): string {
    return this.props.content;
  }

  get displayOrder(): number {
    return this.props.displayOrder;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get version(): number {
    return this.props.version;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get updatedBy(): string | null {
    return this.props.updatedBy ?? null;
  }

  // Parse content as typed object
  getContentParsed<T>(): T {
    return JSON.parse(this.props.content) as T;
  }

  // Convert to plain object
  toObject(): ContentSectionProps {
    return { ...this.props };
  }

  // With parsed content
  toObjectWithContent<T>(): Omit<ContentSectionProps, "content"> & {
    content: T;
  } {
    return {
      ...this.props,
      content: this.getContentParsed<T>(),
    };
  }
}

export class ContentSectionHistoryEntity {
  private constructor(private readonly props: ContentSectionHistoryProps) {}

  static create(
    props: ContentSectionHistoryProps
  ): ContentSectionHistoryEntity {
    return new ContentSectionHistoryEntity(props);
  }

  get id(): string {
    return this.props.id;
  }

  get sectionId(): string {
    return this.props.sectionId;
  }

  get sectionType(): string {
    return this.props.sectionType;
  }

  get content(): string {
    return this.props.content;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get createdBy(): string | null {
    return this.props.createdBy ?? null;
  }

  get createdByName(): string | null {
    return this.props.createdByName ?? null;
  }

  getContentParsed<T>(): T {
    return JSON.parse(this.props.content) as T;
  }

  toObject(): ContentSectionHistoryProps {
    return { ...this.props };
  }
}
