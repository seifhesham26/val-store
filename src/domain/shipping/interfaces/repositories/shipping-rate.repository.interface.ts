/**
 * Shipping Rate Repository Interface
 */

import type { GovernorateRate } from "@/domain/shipping/shipping-rate";

export interface ShippingConfig {
  rates: GovernorateRate[];
  freeShippingThreshold: number;
}

export interface ShippingRateUpdate {
  governorate: string;
  fee: number;
  isDeliverable: boolean;
}

export interface ShippingRateRepositoryInterface {
  /**
   * Everything needed to price a delivery, in one call.
   *
   * The rates and the threshold live in different tables, and every caller
   * needs both — quoting with one and not the other is always a bug. Fetching
   * them together also costs one round trip rather than two, since postgres.js
   * pipelines queries issued together.
   */
  getConfig(): Promise<ShippingConfig>;

  /** Replace the fee and deliverability for the given governorates. */
  upsertRates(rates: ShippingRateUpdate[], userId: string): Promise<void>;

  setFreeShippingThreshold(value: number, userId: string): Promise<void>;
}
