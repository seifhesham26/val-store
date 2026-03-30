/**
 * Drizzle Site Config Repository
 *
 * Implementation of ISiteConfigRepository using Drizzle ORM.
 * Handles site settings, content sections with history, and featured items.
 */

import { db } from "@/db";
import {
  siteSettings,
  contentSections,
  contentSectionsHistory,
  featuredItems,
} from "@/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import {
  ISiteConfigRepository,
  UpdateSiteSettingsInput,
  UpdateContentSectionInput,
  CreateFeaturedItemInput,
} from "@/domain/site/interfaces/repositories/site-config.repository.interface";
import {
  SiteSettingsEntity,
  SiteSettingsProps,
} from "@/domain/site/entities/site-settings.entity";
import {
  ContentSectionEntity,
  ContentSectionHistoryEntity,
} from "@/domain/site/entities/content-section.entity";
import { FeaturedItemEntity } from "@/domain/site/entities/featured-item.entity";

export class DrizzleSiteConfigRepository implements ISiteConfigRepository {
  // ============================================
  // SITE SETTINGS
  // ============================================

  async getSiteSettings(): Promise<SiteSettingsEntity | null> {
    const [result] = await db.select().from(siteSettings).limit(1);
    if (!result) return null;
    return SiteSettingsEntity.create(result as SiteSettingsProps);
  }

  async updateSiteSettings(
    data: UpdateSiteSettingsInput,
    updatedBy?: string
  ): Promise<SiteSettingsEntity> {
    // Get or create settings
    let settings = await this.getSiteSettings();
    if (!settings) {
      settings = await this.initializeSiteSettings();
    }

    const [updated] = await db
      .update(siteSettings)
      .set({
        ...data,
        updatedAt: new Date(),
        updatedBy: updatedBy ?? null,
      })
      .where(eq(siteSettings.id, settings.id))
      .returning();

    return SiteSettingsEntity.create(updated as SiteSettingsProps);
  }

  async initializeSiteSettings(): Promise<SiteSettingsEntity> {
    const [created] = await db
      .insert(siteSettings)
      .values({
        storeName: "Valkyrie",
        currency: "USD",
        locale: "en-US",
        timezone: "UTC",
      })
      .returning();

    return SiteSettingsEntity.create(created as SiteSettingsProps);
  }

  // ============================================
  // CONTENT SECTIONS
  // ============================================

  async getContentSection(
    sectionType: string
  ): Promise<ContentSectionEntity | null> {
    const [result] = await db
      .select()
      .from(contentSections)
      .where(eq(contentSections.sectionType, sectionType))
      .limit(1);

    if (!result) return null;
    return ContentSectionEntity.create({
      id: result.id,
      sectionType: result.sectionType,
      content: result.content,
      displayOrder: result.displayOrder,
      isActive: result.isActive,
      version: result.version,
      updatedAt: result.updatedAt,
      updatedBy: result.updatedBy,
    });
  }

  async getAllContentSections(): Promise<ContentSectionEntity[]> {
    const results = await db
      .select()
      .from(contentSections)
      .orderBy(asc(contentSections.displayOrder));

    return results.map((r) =>
      ContentSectionEntity.create({
        id: r.id,
        sectionType: r.sectionType,
        content: r.content,
        displayOrder: r.displayOrder,
        isActive: r.isActive,
        version: r.version,
        updatedAt: r.updatedAt,
        updatedBy: r.updatedBy,
      })
    );
  }

  async getActiveContentSections(): Promise<ContentSectionEntity[]> {
    const results = await db
      .select()
      .from(contentSections)
      .where(eq(contentSections.isActive, true))
      .orderBy(asc(contentSections.displayOrder));

    return results.map((r) =>
      ContentSectionEntity.create({
        id: r.id,
        sectionType: r.sectionType,
        content: r.content,
        displayOrder: r.displayOrder,
        isActive: r.isActive,
        version: r.version,
        updatedAt: r.updatedAt,
        updatedBy: r.updatedBy,
      })
    );
  }

  async createContentSection(
    sectionType: string,
    content: string,
    updatedBy?: string
  ): Promise<ContentSectionEntity> {
    const [created] = await db
      .insert(contentSections)
      .values({
        sectionType,
        content,
        version: 1,
        updatedBy: updatedBy ?? null,
      })
      .returning();

    return ContentSectionEntity.create({
      id: created.id,
      sectionType: created.sectionType,
      content: created.content,
      displayOrder: created.displayOrder,
      isActive: created.isActive,
      version: created.version,
      updatedAt: created.updatedAt,
      updatedBy: created.updatedBy,
    });
  }

  async updateContentSection(
    sectionType: string,
    data: UpdateContentSectionInput,
    updatedBy?: string
  ): Promise<ContentSectionEntity> {
    // Get existing section
    const section = await this.getContentSection(sectionType);

    // Create if doesn't exist
    if (!section) {
      return this.createContentSection(sectionType, data.content, updatedBy);
    }

    // Save current version to history before updating
    await db.insert(contentSectionsHistory).values({
      sectionId: section.id,
      sectionType: section.sectionType,
      content: section.content,
      version: section.version,
      createdBy: updatedBy ?? null,
    });

    // Update with new content and increment version
    const [updated] = await db
      .update(contentSections)
      .set({
        content: data.content,
        displayOrder: data.displayOrder ?? section.displayOrder,
        isActive: data.isActive ?? section.isActive,
        version: section.version + 1,
        updatedAt: new Date(),
        updatedBy: updatedBy ?? null,
      })
      .where(eq(contentSections.sectionType, sectionType))
      .returning();

    return ContentSectionEntity.create({
      id: updated.id,
      sectionType: updated.sectionType,
      content: updated.content,
      displayOrder: updated.displayOrder,
      isActive: updated.isActive,
      version: updated.version,
      updatedAt: updated.updatedAt,
      updatedBy: updated.updatedBy,
    });
  }

  // ============================================
  // CONTENT SECTION HISTORY
  // ============================================

  async getContentHistory(
    sectionType: string
  ): Promise<ContentSectionHistoryEntity[]> {
    const results = await db
      .select()
      .from(contentSectionsHistory)
      .where(eq(contentSectionsHistory.sectionType, sectionType))
      .orderBy(desc(contentSectionsHistory.version));

    return results.map((r) =>
      ContentSectionHistoryEntity.create({
        id: r.id,
        sectionId: r.sectionId,
        sectionType: r.sectionType,
        content: r.content,
        version: r.version,
        createdAt: r.createdAt,
        createdBy: r.createdBy,
      })
    );
  }

  async revertToVersion(
    sectionType: string,
    version: number,
    updatedBy?: string
  ): Promise<ContentSectionEntity> {
    // Find the history entry
    const [historyEntry] = await db
      .select()
      .from(contentSectionsHistory)
      .where(
        and(
          eq(contentSectionsHistory.sectionType, sectionType),
          eq(contentSectionsHistory.version, version)
        )
      )
      .limit(1);

    if (!historyEntry) {
      throw new Error(
        `Version ${version} not found for section ${sectionType}`
      );
    }

    // Update current section with history content
    return this.updateContentSection(
      sectionType,
      { content: historyEntry.content },
      updatedBy
    );
  }

  // ============================================
  // FEATURED ITEMS
  // ============================================

  async getFeaturedItems(section: string): Promise<FeaturedItemEntity[]> {
    const results = await db
      .select()
      .from(featuredItems)
      .where(
        and(
          eq(featuredItems.section, section),
          eq(featuredItems.isActive, true)
        )
      )
      .orderBy(asc(featuredItems.displayOrder));

    return results.map((r) =>
      FeaturedItemEntity.create({
        id: r.id,
        itemType: r.itemType,
        itemId: r.itemId,
        section: r.section,
        displayOrder: r.displayOrder,
        isActive: r.isActive,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })
    );
  }

  async getFeaturedItemsByType(
    section: string,
    itemType: string
  ): Promise<FeaturedItemEntity[]> {
    const results = await db
      .select()
      .from(featuredItems)
      .where(
        and(
          eq(featuredItems.section, section),
          eq(featuredItems.itemType, itemType),
          eq(featuredItems.isActive, true)
        )
      )
      .orderBy(asc(featuredItems.displayOrder));

    return results.map((r) =>
      FeaturedItemEntity.create({
        id: r.id,
        itemType: r.itemType,
        itemId: r.itemId,
        section: r.section,
        displayOrder: r.displayOrder,
        isActive: r.isActive,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })
    );
  }

  async updateFeaturedItems(
    section: string,
    items: CreateFeaturedItemInput[]
  ): Promise<FeaturedItemEntity[]> {
    // Delete existing items for this section
    await db.delete(featuredItems).where(eq(featuredItems.section, section));

    // Insert new items with order
    if (items.length === 0) return [];

    const toInsert = items.map((item, index) => ({
      itemType: item.itemType,
      itemId: item.itemId,
      section: item.section,
      displayOrder: item.displayOrder ?? index,
      isActive: item.isActive ?? true,
    }));

    const created = await db.insert(featuredItems).values(toInsert).returning();

    return created.map((r) =>
      FeaturedItemEntity.create({
        id: r.id,
        itemType: r.itemType,
        itemId: r.itemId,
        section: r.section,
        displayOrder: r.displayOrder,
        isActive: r.isActive,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })
    );
  }

  async addFeaturedItem(
    input: CreateFeaturedItemInput
  ): Promise<FeaturedItemEntity> {
    // Get max display order
    const existing = await this.getFeaturedItems(input.section);
    const maxOrder = existing.reduce(
      (max, item) => Math.max(max, item.displayOrder),
      -1
    );

    const [created] = await db
      .insert(featuredItems)
      .values({
        itemType: input.itemType,
        itemId: input.itemId,
        section: input.section,
        displayOrder: input.displayOrder ?? maxOrder + 1,
        isActive: input.isActive ?? true,
      })
      .returning();

    return FeaturedItemEntity.create({
      id: created.id,
      itemType: created.itemType,
      itemId: created.itemId,
      section: created.section,
      displayOrder: created.displayOrder,
      isActive: created.isActive,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    });
  }

  async removeFeaturedItem(id: string): Promise<void> {
    await db.delete(featuredItems).where(eq(featuredItems.id, id));
  }

  async reorderFeaturedItems(
    section: string,
    orderedIds: string[]
  ): Promise<void> {
    // Update display order for each item
    await Promise.all(
      orderedIds.map((id, index) =>
        db
          .update(featuredItems)
          .set({ displayOrder: index, updatedAt: new Date() })
          .where(
            and(eq(featuredItems.id, id), eq(featuredItems.section, section))
          )
      )
    );
  }
}
