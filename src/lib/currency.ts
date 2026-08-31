/**
 * Store currency
 *
 * One declaration of what money means here, used by everything that charges,
 * stores or displays it. Before this there were four answers: Stripe charged
 * `egp`, the order repository wrote `EGP`, `site_settings.currency` defaulted to
 * `USD`, and every price in the UI was rendered with a hardcoded `$`. Customers
 * in Egypt were billed in pounds and shown dollars.
 *
 * It is deployment configuration rather than a database setting on purpose: a
 * Stripe account is bound to the currency it charges in, and every price already
 * stored is denominated in it, so switching is a migration — not a dropdown.
 */

/** ISO 4217 code. Override per-deployment with `NEXT_PUBLIC_STORE_CURRENCY`. */
export const STORE_CURRENCY = (
  process.env.NEXT_PUBLIC_STORE_CURRENCY || "EGP"
).toUpperCase();

/** Stripe wants the code lowercased. */
export const STRIPE_CURRENCY = STORE_CURRENCY.toLowerCase();

/**
 * The locale prices are formatted in.
 *
 * Not the visitor's locale: the store shows one set of prices to everyone, and
 * formatting the same number differently per browser makes totals look like
 * they disagree.
 */
const PRICE_LOCALE = process.env.NEXT_PUBLIC_STORE_LOCALE || "en-EG";

const formatter = new Intl.NumberFormat(PRICE_LOCALE, {
  style: "currency",
  currency: STORE_CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format an amount as a price.
 *
 * Non-finite input formats as zero rather than "NaN" — a broken total should
 * look wrong to whoever reads the code, not to the customer.
 */
export function formatCurrency(amount: number): string {
  return formatter.format(Number.isFinite(amount) ? amount : 0);
}

/**
 * Format a signed adjustment, e.g. a discount or a refund line.
 *
 * The sign goes outside the currency so "-EGP 20.00" reads as money removed
 * rather than as a negative price.
 */
export function formatCurrencyDelta(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${formatCurrency(Math.abs(amount))}`;
}

/**
 * Compact price, for places where a full amount does not fit.
 *
 * Chart axes are the case this exists for: a tick per gridline rendered as
 * `EGP 1,234.00` is wider than the plot area, which is why those axes were
 * still drawing a bare `$` long after every other price was converted.
 */
const compactFormatter = new Intl.NumberFormat(PRICE_LOCALE, {
  style: "currency",
  currency: STORE_CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCurrencyCompact(amount: number): string {
  return compactFormatter.format(Number.isFinite(amount) ? amount : 0);
}
