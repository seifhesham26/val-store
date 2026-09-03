import { describe, it, expect } from "vitest";
import {
  toDayKey,
  startOfWindow,
  toDenseDailySeries,
  type DailySalesRow,
} from "./sales-series";

/**
 * A fixed "now" so the window is deterministic: Wednesday 2026-09-16, mid
 * afternoon local. The time-of-day is deliberately not midnight — the window
 * must start at the beginning of a day regardless of when it is computed.
 */
const NOW = new Date(2026, 8, 16, 14, 37, 12, 500);

describe("toDayKey", () => {
  it("formats as YYYY-MM-DD with zero padding", () => {
    expect(toDayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toDayKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("uses local date parts, not UTC", () => {
    // Late evening local on the 16th. `toISOString()` would roll this forward
    // to the 17th for any timezone behind UTC, mis-bucketing a day's sales at
    // the boundary — the database groups by its own session timezone, so the
    // key has to be built from local parts to agree with it.
    const lateEvening = new Date(2026, 8, 16, 23, 30);

    expect(toDayKey(lateEvening)).toBe("2026-09-16");
    expect(toDayKey(lateEvening)).toBe(
      `2026-09-${`${lateEvening.getDate()}`.padStart(2, "0")}`
    );
  });
});

describe("startOfWindow", () => {
  it("is inclusive of today, so N days spans today plus N-1 before it", () => {
    expect(toDayKey(startOfWindow(7, NOW))).toBe("2026-09-10");
    expect(toDayKey(startOfWindow(1, NOW))).toBe("2026-09-16");
  });

  it("starts at midnight whatever time of day it is called", () => {
    const start = startOfWindow(30, NOW);

    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it("crosses a month boundary", () => {
    expect(toDayKey(startOfWindow(30, NOW))).toBe("2026-08-18");
  });
});

describe("toDenseDailySeries", () => {
  it("returns exactly one entry per day in the window, ascending", () => {
    const series = toDenseDailySeries([], 7, NOW);

    expect(series).toHaveLength(7);
    expect(series.map((row) => row.date)).toEqual([
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
    ]);
  });

  it("zero-fills days the query returned no row for", () => {
    const rows: DailySalesRow[] = [
      { date: "2026-09-12", revenue: 250.5, orders: 3 },
      { date: "2026-09-16", revenue: 80, orders: 1 },
    ];

    const series = toDenseDailySeries(rows, 7, NOW);

    expect(series).toHaveLength(7);
    expect(series.find((r) => r.date === "2026-09-12")).toEqual({
      date: "2026-09-12",
      revenue: 250.5,
      orders: 3,
    });
    expect(series.find((r) => r.date === "2026-09-11")).toEqual({
      date: "2026-09-11",
      revenue: 0,
      orders: 0,
    });
  });

  it("makes index-based period comparison mean calendar periods", () => {
    // This is the whole reason the function exists. `SalesChart` sums
    // `slice(-7)` against `slice(-14,-7)`. With a sparse series those slices
    // cover whatever days happened to sell; with a dense one they are always
    // the last seven days against the seven before them.
    //
    // Sales here: 100 on each of the last 7 days, 50 on each of the 7 before,
    // but expressed sparsely — the quiet days simply have no row.
    const rows: DailySalesRow[] = [
      { date: "2026-09-03", revenue: 50, orders: 1 },
      { date: "2026-09-06", revenue: 50, orders: 1 },
      { date: "2026-09-09", revenue: 50, orders: 1 },
      { date: "2026-09-10", revenue: 100, orders: 2 },
      { date: "2026-09-14", revenue: 100, orders: 2 },
      { date: "2026-09-16", revenue: 100, orders: 2 },
    ];

    const series = toDenseDailySeries(rows, 14, NOW);
    expect(series).toHaveLength(14);

    const sum = (window: DailySalesRow[]) =>
      window.reduce((total, row) => total + row.revenue, 0);

    const recent = sum(series.slice(-7));
    const previous = sum(series.slice(-14, -7));

    // The recent week is 09-10..09-16 and the previous 09-03..09-09 — a
    // property of the dates, not of how many rows came back.
    expect(series.slice(-7)[0].date).toBe("2026-09-10");
    expect(series.slice(-14, -7)[0].date).toBe("2026-09-03");

    expect(recent).toBe(300);
    expect(previous).toBe(150);

    // Sparse, the same rows would have compared the last 7 *rows*
    // (09-09..09-16 → 50+100+100+100 = 350) against only 2 earlier ones,
    // which is the mismatched comparison this replaces.
    expect(rows.slice(-7)).toHaveLength(6);
  });

  it("ignores rows outside the window rather than lengthening the series", () => {
    // A stray row must not change the length: the chart's period comparison
    // is index-based, so an extra entry would shift both slices by a day.
    const rows: DailySalesRow[] = [
      { date: "2020-01-01", revenue: 9999, orders: 99 },
      { date: "2026-09-16", revenue: 10, orders: 1 },
    ];

    const series = toDenseDailySeries(rows, 7, NOW);

    expect(series).toHaveLength(7);
    expect(series.some((row) => row.date === "2020-01-01")).toBe(false);
    expect(series.at(-1)).toEqual({
      date: "2026-09-16",
      revenue: 10,
      orders: 1,
    });
  });

  it("handles a window that crosses a month boundary", () => {
    const series = toDenseDailySeries(
      [{ date: "2026-08-31", revenue: 20, orders: 1 }],
      30,
      NOW
    );

    expect(series).toHaveLength(30);
    expect(series[0].date).toBe("2026-08-18");
    expect(series.at(-1)?.date).toBe("2026-09-16");
    expect(series.find((r) => r.date === "2026-08-31")?.revenue).toBe(20);
  });
});
