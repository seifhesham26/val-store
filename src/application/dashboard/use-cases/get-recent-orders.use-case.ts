/**
 * Get Recent Orders Use Case
 *
 * Returns recent orders for the dashboard.
 */

import {
  DashboardRepositoryInterface,
  RecentOrder,
} from "@/domain/dashboard/interfaces/repositories/dashboard.repository.interface";
import type { OrderStatusValue } from "@/domain/orders/value-objects/order-status.value-object";

export interface GetRecentOrdersInput {
  limit?: number;
  statuses?: OrderStatusValue[];
}

export class GetRecentOrdersUseCase {
  constructor(
    private readonly dashboardRepository: DashboardRepositoryInterface
  ) {}

  async execute(input?: GetRecentOrdersInput): Promise<RecentOrder[]> {
    return this.dashboardRepository.getRecentOrders(
      input?.limit,
      input?.statuses
    );
  }
}
