/**
 * Get Analytics Use Case
 *
 * Returns analytics data for the admin analytics page.
 */

import {
  DashboardRepositoryInterface,
  AnalyticsData,
} from "@/domain/interfaces/repositories/dashboard.repository.interface";

export class GetAnalyticsUseCase {
  constructor(
    private readonly dashboardRepository: DashboardRepositoryInterface
  ) {}

  async execute(days: number = 30): Promise<AnalyticsData> {
    return this.dashboardRepository.getAnalytics(days);
  }
}
