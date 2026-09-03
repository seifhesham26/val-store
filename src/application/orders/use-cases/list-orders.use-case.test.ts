/**
 * List Orders Use Case Tests
 *
 * Regression coverage for finding #17: `minTotal`/`maxTotal` were accepted by
 * the admin router, silently dropped by this use case before they ever
 * reached the repository, and the repository's own filter object used a
 * different name (`minAmount`/`maxAmount`) that nothing implemented. An admin
 * filtering "total over 5000" got the unfiltered list back with no error —
 * every row presented as matching a filter that was never applied.
 *
 * The repository itself needs a database to exercise, so this only proves
 * the use case forwards what it's given rather than silently narrowing it —
 * which is exactly where the bug was.
 */

import { describe, it, expect, vi } from "vitest";
import { ListOrdersUseCase } from "./list-orders.use-case";
import type { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";

function makeRepo(
  overrides: Partial<OrderRepositoryInterface> = {}
): OrderRepositoryInterface {
  return {
    findById: vi.fn(),
    findAll: vi.fn().mockResolvedValue([]),
    findByUserId: vi.fn(),
    findByStatus: vi.fn(),
    findRecentByUserId: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    refund: vi.fn(),
    findExpiredCheckouts: vi.fn(),
    markPaymentFailed: vi.fn(),
    markAsPaid: vi.fn(),
    countByStatus: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

describe("ListOrdersUseCase", () => {
  it("forwards minTotal and maxTotal to both findAll and count", async () => {
    const repo = makeRepo();
    const useCase = new ListOrdersUseCase(repo);

    await useCase.execute({ minTotal: 100, maxTotal: 500 });

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ minTotal: 100, maxTotal: 500 })
    );
    expect(repo.count).toHaveBeenCalledWith(
      expect.objectContaining({ minTotal: 100, maxTotal: 500 })
    );
  });

  it("forwards a lone minTotal without inventing a maxTotal", async () => {
    const repo = makeRepo();
    const useCase = new ListOrdersUseCase(repo);

    await useCase.execute({ minTotal: 250 });

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ minTotal: 250, maxTotal: undefined })
    );
  });

  it("still forwards every other filter alongside the amount bounds", async () => {
    const repo = makeRepo();
    const useCase = new ListOrdersUseCase(repo);

    await useCase.execute({
      status: "paid",
      refundableOnly: true,
      minTotal: 100,
      maxTotal: 500,
    });

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paid",
        refundableOnly: true,
        minTotal: 100,
        maxTotal: 500,
      })
    );
  });
});
