/**
 * Get Sales Trend Use Case
 *
 * Returns sales trend data for dashboard charts.
 */

import {
  DashboardRepositoryInterface,
  SalesTrendItem,
} from "@/domain/interfaces/repositories/dashboard.repository.interface";

export class GetSalesTrendUseCase {
  constructor(
    private readonly dashboardRepository: DashboardRepositoryInterface
  ) {}

  async execute(): Promise<SalesTrendItem[]> {
    return this.dashboardRepository.getSalesTrend();
  }
}
