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
import { eq, and, desc, count, sql } from "drizzle-orm";
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

    // Get primary image subquery
    const primaryImage = db
      .select({
        productId: productImages.productId,
        imageUrl: sql<string>`MIN(${productImages.imageUrl})`.as("imageUrl"),
      })
      .from(productImages)
      .groupBy(productImages.productId)
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

  async markAsRead(id: string): Promise<void> {
    await db
      .update(userNotifications)
      .set({ isRead: true })
      .where(eq(userNotifications.id, id));
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

  async delete(id: string): Promise<void> {
    await db.delete(userNotifications).where(eq(userNotifications.id, id));
  }

  async deleteAll(userId: string): Promise<void> {
    await db
      .delete(userNotifications)
      .where(eq(userNotifications.userId, userId));
  }
}
