/**
 * Site Config Repository Interface
 *
 * Contract for managing site settings, content sections, and featured items.
 */

import { SiteSettingsEntity } from "@/domain/site/entities/site-settings.entity";
import {
  ContentSectionEntity,
  ContentSectionHistoryEntity,
} from "@/domain/site/entities/content-section.entity";
import { FeaturedItemEntity } from "@/domain/site/entities/featured-item.entity";

// ============================================
// SITE SETTINGS
// ============================================

export interface UpdateSiteSettingsInput {
  storeName?: string;
  storeTagline?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  twitterUrl?: string | null;
  tiktokUrl?: string | null;
  currency?: string;
  locale?: string;
  timezone?: string;
  defaultMetaTitle?: string | null;
  defaultMetaDescription?: string | null;
}

// ============================================
// CONTENT SECTIONS
// ============================================

export interface UpdateContentSectionInput {
  content: string; // JSON stringified
  displayOrder?: number;
  isActive?: boolean;
}

export interface CreateFeaturedItemInput {
  itemType: string;
  itemId: string;
  section: string;
  displayOrder?: number;
  isActive?: boolean;
}

// ============================================
// REPOSITORY INTERFACE
// ============================================

export interface ISiteConfigRepository {
  // Site Settings
  getSiteSettings(): Promise<SiteSettingsEntity | null>;
  updateSiteSettings(
    data: UpdateSiteSettingsInput,
    updatedBy?: string
  ): Promise<SiteSettingsEntity>;
  initializeSiteSettings(): Promise<SiteSettingsEntity>;

  // Content Sections
  getContentSection(sectionType: string): Promise<ContentSectionEntity | null>;
  getAllContentSections(): Promise<ContentSectionEntity[]>;
  getActiveContentSections(): Promise<ContentSectionEntity[]>;
  updateContentSection(
    sectionType: string,
    data: UpdateContentSectionInput,
    updatedBy?: string
  ): Promise<ContentSectionEntity>;
  createContentSection(
    sectionType: string,
    content: string,
    updatedBy?: string
  ): Promise<ContentSectionEntity>;

  // Content Section History
  getContentHistory(
    sectionType: string
  ): Promise<ContentSectionHistoryEntity[]>;
  revertToVersion(
    sectionType: string,
    version: number,
    updatedBy?: string
  ): Promise<ContentSectionEntity>;

  // Featured Items
  getFeaturedItems(section: string): Promise<FeaturedItemEntity[]>;
  getFeaturedItemsByType(
    section: string,
    itemType: string
  ): Promise<FeaturedItemEntity[]>;
  updateFeaturedItems(
    section: string,
    items: CreateFeaturedItemInput[]
  ): Promise<FeaturedItemEntity[]>;
  addFeaturedItem(input: CreateFeaturedItemInput): Promise<FeaturedItemEntity>;
  removeFeaturedItem(id: string): Promise<void>;
  reorderFeaturedItems(section: string, orderedIds: string[]): Promise<void>;
}
