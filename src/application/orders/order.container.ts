/**
 * Order Domain Container
 *
 * Provides singleton instances of order repository and use cases.
 */

import { DrizzleOrderRepository } from "@/infrastructure/database/repositories/orders/order.repository";
import { ListOrdersUseCase } from "./use-cases/list-orders.use-case";
import { GetOrderUseCase } from "./use-cases/get-order.use-case";
import { UpdateOrderStatusUseCase } from "./use-cases/update-order-status.use-case";

export function createOrderModule() {
  let repo: DrizzleOrderRepository | undefined;
  const getOrderRepository = () => (repo ??= new DrizzleOrderRepository());

  let listOrders: ListOrdersUseCase | undefined;
  let getOrder: GetOrderUseCase | undefined;
  let updateOrderStatus: UpdateOrderStatusUseCase | undefined;

  return {
    getOrderRepository,
    getListOrdersUseCase: () =>
      (listOrders ??= new ListOrdersUseCase(getOrderRepository())),
    getGetOrderUseCase: () =>
      (getOrder ??= new GetOrderUseCase(getOrderRepository())),
    getUpdateOrderStatusUseCase: () =>
      (updateOrderStatus ??= new UpdateOrderStatusUseCase(
        getOrderRepository()
      )),
  };
}

export type OrderModule = ReturnType<typeof createOrderModule>;
