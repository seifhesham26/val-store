/**
 * Shipping module
 *
 * Delivery rates per governorate, plus the store-wide free-shipping threshold.
 * No dependencies on other domains, so it takes no `deps` argument.
 */

import { DrizzleShippingRateRepository } from "@/infrastructure/database/repositories/shipping/shipping-rate.repository";
import type { ShippingRateRepositoryInterface } from "@/domain/shipping/interfaces/repositories/shipping-rate.repository.interface";

export function createShippingModule() {
  let shippingRateRepository: ShippingRateRepositoryInterface | undefined;

  return {
    getShippingRateRepository(): ShippingRateRepositoryInterface {
      shippingRateRepository ??= new DrizzleShippingRateRepository();
      return shippingRateRepository;
    },
  };
}
