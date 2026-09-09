/**
 * Locale and timezone for user-facing date and number formatting.
 *
 * Deployment config, exactly like `STORE_CURRENCY` in `./currency.ts` — a store
 * that changes market changes an env var, not a dozen call sites.
 *
 * The default is `en-GB`, not `en-EG`. Both render day-month-year, which is
 * Egyptian convention, but `en-EG` is absent from some ICU builds and `Intl`
 * then falls back to plain `en`, which renders MONTH-day and silently
 * reintroduces the American order this exists to remove. `en-GB` is universally
 * available and cannot fall back to the wrong order.
 *
 * The storefront is English-only by decision, so an Arabic locale is not the
 * default here. Revisit that together with Arabic content, not before.
 */
export const STORE_LOCALE = process.env.NEXT_PUBLIC_STORE_LOCALE ?? "en-GB";

/** Egypt observes EET (UTC+2). */
export const STORE_TIMEZONE =
  process.env.NEXT_PUBLIC_STORE_TIMEZONE ?? "Africa/Cairo";

/** A plain `YYYY-MM-DD` rendered for readers, e.g. "9 September 2026". */
export function formatStoreDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  // Constructed as UTC and formatted in UTC: a date column has no time, so
  // letting a timezone shift it can move it a day.
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(STORE_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
