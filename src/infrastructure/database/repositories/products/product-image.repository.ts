/**
 * ProductImage Repository Implementation
 *
 * Implements ProductImageRepositoryInterface using Drizzle ORM.
 */

import { db } from "@/db";
import { productImages } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { ProductImageRepositoryInterface } from "@/domain/products/interfaces/repositories/product-image.repository.interface";
import { ProductImageEntity } from "@/domain/products/entities/product-image.entity";

export class DrizzleProductImageRepository implements ProductImageRepositoryInterface {
  /**
   * Find image by ID
   */
  async findById(imageId: string): Promise<ProductImageEntity | null> {
    const image = await db.query.productImages.findFirst({
      where: eq(productImages.id, imageId),
    });

    if (!image) return null;
    return this.mapToEntity(image);
  }

  /**
   * Find all images for a product
   */
  async findByProduct(productId: string): Promise<ProductImageEntity[]> {
    const images = await db.query.productImages.findMany({
      where: eq(productImages.productId, productId),
      orderBy: [asc(productImages.displayOrder)],
    });

    return images.map((i) => this.mapToEntity(i));
  }

  /**
   * Find primary image for a product
   */
  async findPrimaryByProduct(
    productId: string
  ): Promise<ProductImageEntity | null> {
    const image = await db.query.productImages.findFirst({
      where: eq(productImages.productId, productId),
      orderBy: [asc(productImages.displayOrder)],
    });

    // Return first image if no primary set, or the primary one
    const primary = await db.query.productImages.findFirst({
      where: eq(productImages.isPrimary, true),
    });

    if (primary && primary.productId === productId) {
      return this.mapToEntity(primary);
    }

    if (!image) return null;
    return this.mapToEntity(image);
  }

  /**
   * Create a new image
   */
  async create(image: ProductImageEntity): Promise<ProductImageEntity> {
    const [newImage] = await db
      .insert(productImages)
      .values({
        productId: image.productId,
        imageUrl: image.imageUrl,
        altText: image.altText,
        displayOrder: image.displayOrder,
        isPrimary: image.isPrimary,
      })
      .returning();

    return this.mapToEntity(newImage);
  }

  /**
   * Update an existing image
   */
  async update(image: ProductImageEntity): Promise<ProductImageEntity> {
    const [updated] = await db
      .update(productImages)
      .set({
        imageUrl: image.imageUrl,
        altText: image.altText,
        displayOrder: image.displayOrder,
        isPrimary: image.isPrimary,
      })
      .where(eq(productImages.id, image.id))
      .returning();

    return this.mapToEntity(updated);
  }

  /**
   * Delete an image
   */
  async delete(imageId: string): Promise<void> {
    await db.delete(productImages).where(eq(productImages.id, imageId));
  }

  /**
   * Delete all images for a product
   */
  async deleteByProduct(productId: string): Promise<void> {
    await db
      .delete(productImages)
      .where(eq(productImages.productId, productId));
  }

  /**
   * Set an image as primary (and unset others)
   */
  async setPrimary(productId: string, imageId: string): Promise<void> {
    // First, unset all primary flags for this product
    await db
      .update(productImages)
      .set({ isPrimary: false })
      .where(eq(productImages.productId, productId));

    // Then set the specified image as primary
    await db
      .update(productImages)
      .set({ isPrimary: true })
      .where(eq(productImages.id, imageId));
  }

  /**
   * Update display order for multiple images
   */
  async updateDisplayOrder(
    imageOrders: Array<{ id: string; displayOrder: number }>
  ): Promise<void> {
    // Use a transaction for atomicity
    await db.transaction(async (tx) => {
      for (const order of imageOrders) {
        await tx
          .update(productImages)
          .set({ displayOrder: order.displayOrder })
          .where(eq(productImages.id, order.id));
      }
    });
  }

  /**
   * Get count of images for a product
   */
  async countByProduct(productId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(productImages)
      .where(eq(productImages.productId, productId));

    return Number(result[0]?.count ?? 0);
  }

  /**
   * Map database result to entity
   */
  private mapToEntity(dbImage: {
    id: string;
    productId: string;
    imageUrl: string;
    altText: string | null;
    displayOrder: number;
    isPrimary: boolean;
    createdAt: Date;
  }): ProductImageEntity {
    return new ProductImageEntity(
      dbImage.id,
      dbImage.productId,
      dbImage.imageUrl,
      dbImage.altText,
      dbImage.displayOrder,
      dbImage.isPrimary,
      new Date(dbImage.createdAt)
    );
  }
}
