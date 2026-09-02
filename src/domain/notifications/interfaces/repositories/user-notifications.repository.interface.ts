/**
 * User Notifications Repository Interface
 */

import { UserNotification, NewUserNotification } from "@/db/schema";

export interface UserNotificationWithProduct extends UserNotification {
  productName?: string | null;
  productSlug?: string | null;
  productImage?: string | null;
}

export interface UserNotificationsRepositoryInterface {
  create(notification: NewUserNotification): Promise<UserNotification>;
  createMany(notifications: NewUserNotification[]): Promise<void>;
  findByUser(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number }
  ): Promise<UserNotificationWithProduct[]>;
  /**
   * The owner is required, not optional.
   *
   * These two took an id alone, so any signed-in user holding another user's
   * notification UUID could mark it read or delete it outright. The sibling
   * methods below always scoped correctly; nothing forced the difference.
   */
  markAsRead(id: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
  delete(id: string, userId: string): Promise<void>;
  deleteAll(userId: string): Promise<void>;
}
