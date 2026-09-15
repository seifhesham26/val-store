/**
 * Inventory Domain Container
 */

import { DrizzleInventoryRepository } from "@/infrastructure/database/repositories/inventory/inventory.repository";
import { AdjustStockUseCase } from "./use-cases/adjust-stock.use-case";
import { NotificationService } from "@/application/notifications/notification.service";
import { DrizzleInventoryRequestsRepository } from "@/infrastructure/database/repositories/inventory/inventory-requests.repository";
import { SubmitAdjustmentRequestUseCase } from "./use-cases/submit-adjustment-request.use-case";
import { CompleteInventoryInspectionUseCase } from "./use-cases/complete-inventory-inspection.use-case";
import { ReviewAdjustmentRequestUseCase } from "./use-cases/review-adjustment-request.use-case";
import { ListInventoryWorkUseCase } from "./use-cases/list-inventory-work.use-case";

export function createInventoryModule(deps: {
  getNotificationService: () => NotificationService;
}) {
  let repo: DrizzleInventoryRepository | undefined;
  const getInventoryRepository = () =>
    (repo ??= new DrizzleInventoryRepository());

  let adjustStock: AdjustStockUseCase | undefined;
  let requests: DrizzleInventoryRequestsRepository | undefined;
  const getInventoryRequestsRepository = () =>
    (requests ??= new DrizzleInventoryRequestsRepository());
  let submit: SubmitAdjustmentRequestUseCase | undefined;
  let complete: CompleteInventoryInspectionUseCase | undefined;
  let review: ReviewAdjustmentRequestUseCase | undefined;
  let list: ListInventoryWorkUseCase | undefined;

  return {
    getInventoryRepository,
    getInventoryRequestsRepository,
    getSubmitAdjustmentRequestUseCase: () =>
      (submit ??= new SubmitAdjustmentRequestUseCase(
        getInventoryRequestsRepository(),
        deps.getNotificationService()
      )),
    getCompleteInventoryInspectionUseCase: () =>
      (complete ??= new CompleteInventoryInspectionUseCase(
        getInventoryRequestsRepository()
      )),
    getReviewAdjustmentRequestUseCase: () =>
      (review ??= new ReviewAdjustmentRequestUseCase(
        getInventoryRequestsRepository()
      )),
    getListInventoryWorkUseCase: () =>
      (list ??= new ListInventoryWorkUseCase(getInventoryRequestsRepository())),
    getAdjustStockUseCase: () =>
      (adjustStock ??= new AdjustStockUseCase(
        getInventoryRepository(),
        deps.getNotificationService()
      )),
  };
}

export type InventoryModule = ReturnType<typeof createInventoryModule>;
