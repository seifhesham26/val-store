/**
 * Site Settings Entity
 *
 * Represents the store's global configuration settings.
 * Single instance (singleton pattern at DB level).
 */

export interface SiteSettingsProps {
  id: string;
  storeName: string;
  storeTagline?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  twitterUrl?: string | null;
  tiktokUrl?: string | null;
  currency: string;
  locale: string;
  timezone: string;
  defaultMetaTitle?: string | null;
  defaultMetaDescription?: string | null;
  updatedAt: Date;
  updatedBy?: string | null;
}

export class SiteSettingsEntity {
  private constructor(private readonly props: SiteSettingsProps) {}

  static create(props: SiteSettingsProps): SiteSettingsEntity {
    return new SiteSettingsEntity(props);
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get storeName(): string {
    return this.props.storeName;
  }

  get storeTagline(): string | null {
    return this.props.storeTagline ?? null;
  }

  get logoUrl(): string | null {
    return this.props.logoUrl ?? null;
  }

  get faviconUrl(): string | null {
    return this.props.faviconUrl ?? null;
  }

  get contactEmail(): string | null {
    return this.props.contactEmail ?? null;
  }

  get contactPhone(): string | null {
    return this.props.contactPhone ?? null;
  }

  get instagramUrl(): string | null {
    return this.props.instagramUrl ?? null;
  }

  get facebookUrl(): string | null {
    return this.props.facebookUrl ?? null;
  }

  get twitterUrl(): string | null {
    return this.props.twitterUrl ?? null;
  }

  get tiktokUrl(): string | null {
    return this.props.tiktokUrl ?? null;
  }

  get currency(): string {
    return this.props.currency;
  }

  get locale(): string {
    return this.props.locale;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get defaultMetaTitle(): string | null {
    return this.props.defaultMetaTitle ?? null;
  }

  get defaultMetaDescription(): string | null {
    return this.props.defaultMetaDescription ?? null;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get updatedBy(): string | null {
    return this.props.updatedBy ?? null;
  }

  // Social links helper
  get socialLinks(): {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    tiktok?: string;
  } {
    return {
      instagram: this.props.instagramUrl ?? undefined,
      facebook: this.props.facebookUrl ?? undefined,
      twitter: this.props.twitterUrl ?? undefined,
      tiktok: this.props.tiktokUrl ?? undefined,
    };
  }

  // Convert to plain object for API responses
  toObject(): SiteSettingsProps {
    return { ...this.props };
  }

  // Public-safe version (no updatedBy)
  toPublicObject(): Omit<SiteSettingsProps, "updatedBy"> {
    const { updatedBy, ...rest } = this.props;
    void updatedBy; // Intentionally unused - excluded from public output
    return rest;
  }
}
