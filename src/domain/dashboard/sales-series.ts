/**
 * Turning the sales-trend query's result into a dense, one-entry-per-day
 * series.
 *
 * Kept as a pure function, away from the repository, because it is the part
 * that is actually easy to get wrong and impossible to test through Drizzle:
 * `GROUP BY DATE(created_at)` returns rows only for days that had an order,
 * and `SalesChart` compares periods by slicing the array **by index**
 * (`slice(-7)` against `slice(-14,-7)`). Over a gapped series those two
 * slices cover different numbers of real days, so the "% from last period"
 * figure silently compares, say, ten calendar days of sales against four.
 *
 * Filling every day in the window is what makes index arithmetic equal
 * calendar arithmetic, which is the assumption the chart's trend maths has
 * always made and never had.
 */

export interface DailySalesRow {
  /** `YYYY-MM-DD`. */
  date: string;
  revenue: number;
  orders: number;
}

/**
 * The `YYYY-MM-DD` key for a date, in local time.
 *
 * Local rather than UTC deliberately: it has to agree with the key Postgres
 * produced from `DATE(created_at)`, which is evaluated in the database
 * session's timezone. `toISOString()` would shift the day for anyone east or
 * west of UTC and silently mis-bucket a day's takings at the boundary.
 */
export function toDayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The first day of a `days`-long window ending today, at midnight local.
 *
 * Inclusive of today, so `days = 7` spans today plus the six days before it —
 * seven entries, not eight.
 */
export function startOfWindow(days: number, now: Date = new Date()): Date {
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  return start;
}

/**
 * Expand sparse per-day rows into one entry for every day in the window,
 * ascending, with missing days zero-filled.
 *
 * Rows outside the window are ignored rather than appended, so a stray row
 * (a timezone edge, a clock skew) cannot lengthen the series and throw off
 * the index-based period comparison that depends on its length.
 */
export function toDenseDailySeries(
  rows: DailySalesRow[],
  days: number,
  now: Date = new Date()
): DailySalesRow[] {
  const start = startOfWindow(days, now);
  const byDate = new Map(rows.map((row) => [row.date, row]));

  const series: DailySalesRow[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);

    const key = toDayKey(day);
    const found = byDate.get(key);

    series.push({
      date: key,
      revenue: found?.revenue ?? 0,
      orders: found?.orders ?? 0,
    });
  }

  return series;
}
