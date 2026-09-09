/**
 * What delivery costs, by zone.
 *
 * Pure and separate from checkout so it can be tested without a database, and
 * so exactly one place decides a shipping charge. Before this,
 * `CreateOrderUseCase` hardcoded `const shippingCost = 0` while the homepage
 * advertised free delivery and the shipping policy described per-zone fees —
 * three sources of truth, at least two of them wrong at any moment.
 *
 * **Rates default to zero.** Delivery stays free until real numbers are set,
 * which is exactly the behaviour that was already live — turning charging on is
 * a deliberate act, not a side effect of adding this module. Set the env vars
 * below to start charging.
 */

import { resolveShippingZone, type ShippingZone } from "./egypt-governorates";

/** A malformed or negative env value is treated as unset rather than trusted. */
function rate(envValue: string | undefined): number {
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export const SHIPPING_RATES: Record<ShippingZone, number> = {
  cairo_giza: rate(process.env.NEXT_PUBLIC_SHIPPING_CAIRO_GIZA),
  delta: rate(process.env.NEXT_PUBLIC_SHIPPING_DELTA),
  other: rate(process.env.NEXT_PUBLIC_SHIPPING_OTHER),
};

/**
 * Order value at or above which delivery is free.
 *
 * Zero disables the threshold rather than making every order qualify — a
 * threshold of nothing is never what someone means by leaving it unset.
 */
export const FREE_SHIPPING_THRESHOLD = rate(
  process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD
);

export function calculateShippingCost(input: {
  subtotal: number;
  governorate: string | null | undefined;
}): number {
  const base = SHIPPING_RATES[resolveShippingZone(input.governorate)];
  if (base === 0) return 0;
  if (
    FREE_SHIPPING_THRESHOLD > 0 &&
    input.subtotal >= FREE_SHIPPING_THRESHOLD
  ) {
    return 0;
  }
  return base;
}

/** True when the store charges for delivery at all. Drives customer-facing copy. */
export function chargesForShipping(): boolean {
  return Object.values(SHIPPING_RATES).some((r) => r > 0);
}
