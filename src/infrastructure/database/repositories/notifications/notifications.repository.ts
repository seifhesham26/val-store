/**
 * Drizzle Notifications Repository
 */

import { db } from "@/db";
import {
  adminNotifications,
  AdminNotification,
  NewAdminNotification,
} from "@/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { NotificationsRepositoryInterface } from "@/domain/notifications/interfaces/repositories/notifications.repository.interface";

export class DrizzleNotificationsRepository implements NotificationsRepositoryInterface {
  async create(notification: NewAdminNotification): Promise<AdminNotification> {
    const [result] = await db
      .insert(adminNotifications)
      .values(notification)
      .returning();
    return result;
  }

  async findByAdminUser(
    adminUserId: string,
    options?: { unreadOnly?: boolean; limit?: number }
  ): Promise<AdminNotification[]> {
    const conditions = options?.unreadOnly
      ? and(
          eq(adminNotifications.adminUserId, adminUserId),
          eq(adminNotifications.isRead, false)
        )
      : eq(adminNotifications.adminUserId, adminUserId);

    return db.query.adminNotifications.findMany({
      where: conditions,
      orderBy: [desc(adminNotifications.createdAt)],
      limit: options?.limit ?? 50,
    });
  }

  async markAsRead(id: string): Promise<void> {
    await db
      .update(adminNotifications)
      .set({ isRead: true })
      .where(eq(adminNotifications.id, id));
  }

  async markAllAsRead(adminUserId: string): Promise<void> {
    await db
      .update(adminNotifications)
      .set({ isRead: true })
      .where(
        and(
          eq(adminNotifications.adminUserId, adminUserId),
          eq(adminNotifications.isRead, false)
        )
      );
  }

  async getUnreadCount(adminUserId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(adminNotifications)
      .where(
        and(
          eq(adminNotifications.adminUserId, adminUserId),
          eq(adminNotifications.isRead, false)
        )
      );
    return result?.count ?? 0;
  }

  async delete(id: string): Promise<void> {
    await db.delete(adminNotifications).where(eq(adminNotifications.id, id));
  }

  async deleteAll(adminUserId: string): Promise<void> {
    await db
      .delete(adminNotifications)
      .where(eq(adminNotifications.adminUserId, adminUserId));
  }
}
