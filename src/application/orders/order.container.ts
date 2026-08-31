/**
 * Order Domain Container
 *
 * Provides singleton instances of order repository and use cases.
 */

import { DrizzleOrderRepository } from "@/infrastructure/database/repositories/orders/order.repository";
import { ListOrdersUseCase } from "./use-cases/list-orders.use-case";
import { GetOrderUseCase } from "./use-cases/get-order.use-case";
import { UpdateOrderStatusUseCase } from "./use-cases/update-order-status.use-case";
import { CancelExpiredCheckoutsUseCase } from "./use-cases/cancel-expired-checkouts.use-case";
import { RefundOrderUseCase } from "./use-cases/refund-order.use-case";
import { NotificationService } from "@/application/notifications/notification.service";

export function createOrderModule(deps: {
  getNotificationService: () => NotificationService;
}) {
  let repo: DrizzleOrderRepository | undefined;
  const getOrderRepository = () => (repo ??= new DrizzleOrderRepository());

  let listOrders: ListOrdersUseCase | undefined;
  let getOrder: GetOrderUseCase | undefined;
  let updateOrderStatus: UpdateOrderStatusUseCase | undefined;
  let cancelExpiredCheckouts: CancelExpiredCheckoutsUseCase | undefined;
  let refundOrder: RefundOrderUseCase | undefined;

  return {
    getOrderRepository,
    getListOrdersUseCase: () =>
      (listOrders ??= new ListOrdersUseCase(getOrderRepository())),
    getGetOrderUseCase: () =>
      (getOrder ??= new GetOrderUseCase(getOrderRepository())),
    getUpdateOrderStatusUseCase: () =>
      (updateOrderStatus ??= new UpdateOrderStatusUseCase(
        getOrderRepository(),
        deps.getNotificationService()
      )),
    getRefundOrderUseCase: () =>
      (refundOrder ??= new RefundOrderUseCase(
        getOrderRepository(),
        deps.getNotificationService()
      )),
    getCancelExpiredCheckoutsUseCase: () =>
      (cancelExpiredCheckouts ??= new CancelExpiredCheckoutsUseCase(
        getOrderRepository()
      )),
  };
}

export type OrderModule = ReturnType<typeof createOrderModule>;
