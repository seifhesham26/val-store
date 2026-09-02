/**
 * Drizzle User Notifications Repository
 */

import { db } from "@/db";
import {
  userNotifications,
  products,
  productImages,
  UserNotification,
  NewUserNotification,
} from "@/db/schema";
import { eq, and, asc, desc, count } from "drizzle-orm";
import {
  UserNotificationsRepositoryInterface,
  UserNotificationWithProduct,
} from "@/domain/notifications/interfaces/repositories/user-notifications.repository.interface";

export class DrizzleUserNotificationsRepository implements UserNotificationsRepositoryInterface {
  async create(notification: NewUserNotification): Promise<UserNotification> {
    const [result] = await db
      .insert(userNotifications)
      .values(notification)
      .returning();
    return result;
  }

  async createMany(notifications: NewUserNotification[]): Promise<void> {
    if (notifications.length === 0) return;
    await db.insert(userNotifications).values(notifications);
  }

  async findByUser(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number }
  ): Promise<UserNotificationWithProduct[]> {
    const conditions = options?.unreadOnly
      ? and(
          eq(userNotifications.userId, userId),
          eq(userNotifications.isRead, false)
        )
      : eq(userNotifications.userId, userId);

    // The primary image, not the alphabetically first one.
    //
    // This was `MIN(image_url)` grouped by product, which returns *an* image —
    // which is why it never looked broken — but not the row flagged
    // `isPrimary`. Every other read path in the codebase resolves
    // `images.find(img => img.isPrimary) ?? images[0]`, and this now agrees
    // with them: DISTINCT ON keeps it to one round trip, and the ORDER BY
    // inside is what selects the row.
    const primaryImage = db
      .selectDistinctOn([productImages.productId], {
        productId: productImages.productId,
        imageUrl: productImages.imageUrl,
      })
      .from(productImages)
      .orderBy(
        productImages.productId,
        desc(productImages.isPrimary),
        asc(productImages.displayOrder)
      )
      .as("primaryImage");

    const results = await db
      .select({
        id: userNotifications.id,
        userId: userNotifications.userId,
        notificationType: userNotifications.notificationType,
        title: userNotifications.title,
        message: userNotifications.message,
        productId: userNotifications.productId,
        isRead: userNotifications.isRead,
        createdAt: userNotifications.createdAt,
        productName: products.name,
        productSlug: products.slug,
        productImage: primaryImage.imageUrl,
      })
      .from(userNotifications)
      .leftJoin(products, eq(userNotifications.productId, products.id))
      .leftJoin(primaryImage, eq(products.id, primaryImage.productId))
      .where(conditions)
      .orderBy(desc(userNotifications.createdAt))
      .limit(options?.limit ?? 50);

    return results;
  }

  /**
   * Scoped to the owner.
   *
   * An id alone would let any signed-in user act on another user's row. A
   * non-matching row no-ops, which is the right behaviour — it leaks nothing
   * about whether the id exists.
   */
  async markAsRead(id: string, userId: string): Promise<void> {
    await db
      .update(userNotifications)
      .set({ isRead: true })
      .where(
        and(eq(userNotifications.id, id), eq(userNotifications.userId, userId))
      );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await db
      .update(userNotifications)
      .set({ isRead: true })
      .where(
        and(
          eq(userNotifications.userId, userId),
          eq(userNotifications.isRead, false)
        )
      );
  }

  async getUnreadCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(userNotifications)
      .where(
        and(
          eq(userNotifications.userId, userId),
          eq(userNotifications.isRead, false)
        )
      );
    return result?.count ?? 0;
  }

  /** Scoped to the owner, for the same reason as `markAsRead`. */
  async delete(id: string, userId: string): Promise<void> {
    await db
      .delete(userNotifications)
      .where(
        and(eq(userNotifications.id, id), eq(userNotifications.userId, userId))
      );
  }

  async deleteAll(userId: string): Promise<void> {
    await db
      .delete(userNotifications)
      .where(eq(userNotifications.userId, userId));
  }
}
