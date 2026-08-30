/**
 * Notifications Repository Interface
 */

import { AdminNotification, NewAdminNotification } from "@/db/schema";

export interface NotificationsRepositoryInterface {
  create(notification: NewAdminNotification): Promise<AdminNotification>;
  createMany(notifications: NewAdminNotification[]): Promise<void>;
  /**
   * Everyone who should see admin notifications.
   *
   * Admin notifications are per-user rows, so anything store-wide has to be
   * fanned out. Roles live on `user_profiles`, not on the auth user.
   */
  findAdminUserIds(): Promise<string[]>;
  findByAdminUser(
    adminUserId: string,
    options?: { unreadOnly?: boolean; limit?: number }
  ): Promise<AdminNotification[]>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(adminUserId: string): Promise<void>;
  getUnreadCount(adminUserId: string): Promise<number>;
  delete(id: string): Promise<void>;
  deleteAll(adminUserId: string): Promise<void>;
}
