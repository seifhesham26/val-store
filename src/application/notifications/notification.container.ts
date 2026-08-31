/**
 * Notifications Domain Container
 */

import { DrizzleNotificationsRepository } from "@/infrastructure/database/repositories/notifications/notifications.repository";
import { DrizzleUserNotificationsRepository } from "@/infrastructure/database/repositories/notifications/user-notifications.repository";
import { DrizzleInventoryRepository } from "@/infrastructure/database/repositories/inventory/inventory.repository";
import { NotificationService } from "./notification.service";

export function createNotificationModule(deps: {
  getInventoryRepository: () => DrizzleInventoryRepository;
}) {
  let adminRepo: DrizzleNotificationsRepository | undefined;
  const getAdminNotificationsRepository = () =>
    (adminRepo ??= new DrizzleNotificationsRepository());

  let userRepo: DrizzleUserNotificationsRepository | undefined;
  const getUserNotificationsRepository = () =>
    (userRepo ??= new DrizzleUserNotificationsRepository());

  let service: NotificationService | undefined;

  return {
    getAdminNotificationsRepository,
    getUserNotificationsRepository,
    getNotificationService: () =>
      (service ??= new NotificationService(
        getAdminNotificationsRepository(),
        getUserNotificationsRepository(),
        deps.getInventoryRepository()
      )),
  };
}

export type NotificationModule = ReturnType<typeof createNotificationModule>;
