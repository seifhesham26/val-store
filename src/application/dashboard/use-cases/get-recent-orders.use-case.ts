/**
 * Get Recent Orders Use Case
 *
 * Returns recent orders for the dashboard.
 */

import {
  DashboardRepositoryInterface,
  RecentOrder,
} from "@/domain/interfaces/repositories/dashboard.repository.interface";

export interface GetRecentOrdersInput {
  limit?: number;
}

export class GetRecentOrdersUseCase {
  constructor(
    private readonly dashboardRepository: DashboardRepositoryInterface
  ) {}

  async execute(input?: GetRecentOrdersInput): Promise<RecentOrder[]> {
    return this.dashboardRepository.getRecentOrders(input?.limit);
  }
}
