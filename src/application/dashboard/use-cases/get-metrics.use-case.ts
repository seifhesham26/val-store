/**
 * Get Dashboard Metrics Use Case
 *
 * Returns key metrics for the admin dashboard.
 */

import {
  DashboardRepositoryInterface,
  DashboardMetrics,
} from "@/domain/interfaces/repositories/dashboard.repository.interface";

export class GetDashboardMetricsUseCase {
  constructor(
    private readonly dashboardRepository: DashboardRepositoryInterface
  ) {}

  async execute(): Promise<DashboardMetrics> {
    return this.dashboardRepository.getMetrics();
  }
}
