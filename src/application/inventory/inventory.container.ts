/**
 * Inventory Domain Container
 */

import { DrizzleInventoryRepository } from "@/infrastructure/database/repositories/inventory/inventory.repository";
import { AdjustStockUseCase } from "./use-cases/adjust-stock.use-case";
import { NotificationService } from "@/application/notifications/notification.service";

export function createInventoryModule(deps: {
  getNotificationService: () => NotificationService;
}) {
  let repo: DrizzleInventoryRepository | undefined;
  const getInventoryRepository = () =>
    (repo ??= new DrizzleInventoryRepository());

  let adjustStock: AdjustStockUseCase | undefined;

  return {
    getInventoryRepository,
    getAdjustStockUseCase: () =>
      (adjustStock ??= new AdjustStockUseCase(
        getInventoryRepository(),
        deps.getNotificationService()
      )),
  };
}

export type InventoryModule = ReturnType<typeof createInventoryModule>;
