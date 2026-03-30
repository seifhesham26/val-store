/**
 * Notifications Repository Interface
 */

import { AdminNotification, NewAdminNotification } from "@/db/schema";

export interface NotificationsRepositoryInterface {
  create(notification: NewAdminNotification): Promise<AdminNotification>;
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
