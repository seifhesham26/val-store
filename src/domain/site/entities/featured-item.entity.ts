/**
 * Featured Item Entity
 *
 * Represents a featured product or category for homepage sections.
 */

export type FeaturedItemType = "product" | "category";

export type FeaturedSection =
  | "homepage_featured"
  | "homepage_new_arrivals"
  | "homepage_categories"
  | "homepage_bestsellers";

export interface FeaturedItemProps {
  id: string;
  itemType: string;
  itemId: string;
  section: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class FeaturedItemEntity {
  private constructor(private readonly props: FeaturedItemProps) {}

  static create(props: FeaturedItemProps): FeaturedItemEntity {
    return new FeaturedItemEntity(props);
  }

  get id(): string {
    return this.props.id;
  }

  get itemType(): string {
    return this.props.itemType;
  }

  get itemId(): string {
    return this.props.itemId;
  }

  get section(): string {
    return this.props.section;
  }

  get displayOrder(): number {
    return this.props.displayOrder;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isProduct(): boolean {
    return this.props.itemType === "product";
  }

  isCategory(): boolean {
    return this.props.itemType === "category";
  }

  toObject(): FeaturedItemProps {
    return { ...this.props };
  }
}
