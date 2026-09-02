/**
 * Drizzle Notifications Repository
 */

import { db } from "@/db";
import {
  adminNotifications,
  userProfiles,
  AdminNotification,
  NewAdminNotification,
} from "@/db/schema";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import { NotificationsRepositoryInterface } from "@/domain/notifications/interfaces/repositories/notifications.repository.interface";

export class DrizzleNotificationsRepository implements NotificationsRepositoryInterface {
  async create(notification: NewAdminNotification): Promise<AdminNotification> {
    const [result] = await db
      .insert(adminNotifications)
      .values(notification)
      .returning();
    return result;
  }

  async createMany(notifications: NewAdminNotification[]): Promise<void> {
    if (notifications.length === 0) return;
    await db.insert(adminNotifications).values(notifications);
  }

  async findAdminUserIds(): Promise<string[]> {
    const rows = await db
      .select({ userId: userProfiles.userId })
      .from(userProfiles)
      .where(inArray(userProfiles.role, ["admin", "super_admin"]));

    return rows.map((row) => row.userId);
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

  /**
   * Scoped to the owning admin.
   *
   * An id alone let one admin silently clear another's queue. A non-matching
   * row no-ops, which leaks nothing about whether the id exists.
   */
  async markAsRead(id: string, adminUserId: string): Promise<void> {
    await db
      .update(adminNotifications)
      .set({ isRead: true })
      .where(
        and(
          eq(adminNotifications.id, id),
          eq(adminNotifications.adminUserId, adminUserId)
        )
      );
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

  /** Scoped to the owning admin, for the same reason as `markAsRead`. */
  async delete(id: string, adminUserId: string): Promise<void> {
    await db
      .delete(adminNotifications)
      .where(
        and(
          eq(adminNotifications.id, id),
          eq(adminNotifications.adminUserId, adminUserId)
        )
      );
  }

  async deleteAll(adminUserId: string): Promise<void> {
    await db
      .delete(adminNotifications)
      .where(eq(adminNotifications.adminUserId, adminUserId));
  }
}
