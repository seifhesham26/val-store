/**
 * What delivery costs, given a destination and the store's configured rates.
 *
 * Pure by construction: the rates and the threshold are arguments, not module
 * state. An earlier version read them from `process.env`, which froze them at
 * module load — untestable across combinations, and it put the numbers
 * somewhere the person who actually knows the courier prices could not reach.
 * They now live in `shipping_rates`, edited in the admin.
 *
 * One function decides a shipping charge, and both the checkout and the
 * customer-facing quote go through it, so the price a customer is shown cannot
 * drift from the price they are charged.
 */

import { resolveGovernorateCode } from "./egypt-governorates";

export interface GovernorateRate {
  /** Code from `EGYPT_GOVERNORATES`, e.g. "cairo". */
  governorate: string;
  fee: number;
  isDeliverable: boolean;
}

export interface ShippingQuote {
  fee: number;
  isDeliverable: boolean;
  /**
   * Why the fee is zero, when it is. `threshold` means the order qualified for
   * free delivery; `zero_rate` means this destination is simply free. The UI
   * says different things about each — "you've earned free delivery" is a
   * reward, "delivery here is free" is a fact.
   */
  freeReason: "threshold" | "zero_rate" | null;
  /** False when the address's governorate could not be identified. */
  matched: boolean;
}

export function quoteShipping(input: {
  subtotal: number;
  governorate: string | null | undefined;
  rates: readonly GovernorateRate[];
  freeShippingThreshold: number;
}): ShippingQuote {
  const code = resolveGovernorateCode(input.governorate);

  // An address we cannot place. Refusing the order would punish a customer for
  // data saved before the dropdown existed, and guessing a fee would overcharge
  // them — so it ships free and says it did not match, which is a thing the
  // caller can surface without anyone losing a sale over it.
  if (!code) {
    return {
      fee: 0,
      isDeliverable: true,
      freeReason: "zero_rate",
      matched: false,
    };
  }

  const rate = input.rates.find((r) => r.governorate === code);

  // Configured governorate with no row yet — same reasoning as above.
  if (!rate) {
    return {
      fee: 0,
      isDeliverable: true,
      freeReason: "zero_rate",
      matched: true,
    };
  }

  if (!rate.isDeliverable) {
    return { fee: 0, isDeliverable: false, freeReason: null, matched: true };
  }

  // A negative fee is bad data, not a discount.
  const base = Math.max(0, rate.fee);

  if (base === 0) {
    return {
      fee: 0,
      isDeliverable: true,
      freeReason: "zero_rate",
      matched: true,
    };
  }

  // Zero means "no threshold", never "every order qualifies" — the second
  // reading would give away every delivery the moment someone cleared the field.
  if (
    input.freeShippingThreshold > 0 &&
    input.subtotal >= input.freeShippingThreshold
  ) {
    return {
      fee: 0,
      isDeliverable: true,
      freeReason: "threshold",
      matched: true,
    };
  }

  return { fee: base, isDeliverable: true, freeReason: null, matched: true };
}
