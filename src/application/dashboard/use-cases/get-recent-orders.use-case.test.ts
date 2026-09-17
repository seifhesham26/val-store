import { describe, expect, it, vi } from "vitest";
import { GetRecentOrdersUseCase } from "./get-recent-orders.use-case";
import type { DashboardRepositoryInterface } from "@/domain/dashboard/interfaces/repositories/dashboard.repository.interface";

describe("GetRecentOrdersUseCase", () => {
  it("forwards the worker fulfilment status scope", async () => {
    const getRecentOrders = vi.fn().mockResolvedValue([]);
    const repository = {
      getRecentOrders,
    } as unknown as DashboardRepositoryInterface;
    const useCase = new GetRecentOrdersUseCase(repository);
    const statuses = ["pending", "processing", "paid", "shipped"] as const;

    await useCase.execute({ statuses: [...statuses] });

    expect(getRecentOrders).toHaveBeenCalledWith(undefined, [...statuses]);
  });
});
