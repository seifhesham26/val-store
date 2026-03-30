/**
 * Inventory Domain Container
 */

import { DrizzleInventoryRepository } from "@/infrastructure/database/repositories/inventory/inventory.repository";
import { AdjustStockUseCase } from "./use-cases/adjust-stock.use-case";

export function createInventoryModule() {
  let repo: DrizzleInventoryRepository | undefined;
  const getInventoryRepository = () =>
    (repo ??= new DrizzleInventoryRepository());

  let adjustStock: AdjustStockUseCase | undefined;

  return {
    getInventoryRepository,
    getAdjustStockUseCase: () =>
      (adjustStock ??= new AdjustStockUseCase(getInventoryRepository())),
  };
}

export type InventoryModule = ReturnType<typeof createInventoryModule>;
