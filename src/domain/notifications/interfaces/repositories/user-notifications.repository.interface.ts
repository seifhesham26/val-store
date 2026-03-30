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
  markAsRead(id: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
  delete(id: string): Promise<void>;
  deleteAll(userId: string): Promise<void>;
}
