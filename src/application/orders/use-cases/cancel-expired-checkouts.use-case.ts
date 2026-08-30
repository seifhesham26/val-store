/**
 * Cancel Expired Checkouts Use Case
 *
 * Releases orders whose card payment never arrived within the window.
 *
 * There is no scheduler in this app, so this is swept lazily from read paths
 * that are already happening — the storefront's stock check, the customer's
 * order list, the admin order list. The repository throttles it per process so
 * those reads do not each pay for a scan.
 */

import { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";

export class CancelExpiredCheckoutsUseCase {
  constructor(private readonly orderRepository: OrderRepositoryInterface) {}

  /** Returns how many orders were cancelled. */
  async execute(): Promise<number> {
    try {
      return await this.orderRepository.cancelExpiredCheckouts();
    } catch (error) {
      // Housekeeping must never break the read that triggered it.
      console.error(
        "[Orders] Expiry sweep failed",
        error instanceof Error ? error.message : error
      );
      return 0;
    }
  }
}
