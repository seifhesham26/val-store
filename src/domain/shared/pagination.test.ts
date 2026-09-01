import { describe, it, expect } from "vitest";
import { pageWindow, pageCount } from "./pagination";

describe("pageWindow", () => {
  it("puts page 1 at offset 0", () => {
    // The off-by-one that page 1 never reveals.
    expect(pageWindow(1, 12)).toEqual({ limit: 12, offset: 0 });
  });

  it("advances by exactly one page each time", () => {
    expect(pageWindow(2, 12)).toEqual({ limit: 12, offset: 12 });
    expect(pageWindow(3, 12)).toEqual({ limit: 12, offset: 24 });
    expect(pageWindow(10, 10)).toEqual({ limit: 10, offset: 90 });
  });

  it("produces windows that do not overlap or skip", () => {
    const limit = 12;
    const windows = [1, 2, 3, 4].map((p) => pageWindow(p, limit));
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i].offset).toBe(windows[i - 1].offset + limit);
    }
  });

  it("clamps a page below 1 rather than emitting a negative offset", () => {
    // Page numbers arrive from query strings. Postgres rejects a negative
    // OFFSET outright, so this must not reach the driver.
    expect(pageWindow(0, 12).offset).toBe(0);
    expect(pageWindow(-5, 12).offset).toBe(0);
  });

  it("floors a fractional page instead of emitting a fractional offset", () => {
    expect(pageWindow(2.7, 10)).toEqual({ limit: 10, offset: 10 });
  });

  it("never emits a limit below 1", () => {
    // LIMIT 0 returns nothing, which reads as an empty catalogue rather than a
    // bad request.
    expect(pageWindow(1, 0).limit).toBe(1);
    expect(pageWindow(1, -3).limit).toBe(1);
    expect(pageWindow(1, Number.NaN).limit).toBe(1);
  });
});

describe("pageCount", () => {
  it("rounds up a partial last page", () => {
    expect(pageCount(36, 12)).toBe(3);
    expect(pageCount(37, 12)).toBe(4);
    expect(pageCount(1, 12)).toBe(1);
  });

  it("reports zero pages for an empty result", () => {
    // Not 1. "Page 1 of 1" over nothing offers a page with no rows on it.
    expect(pageCount(0, 12)).toBe(0);
  });

  it("handles an exact multiple without adding a trailing empty page", () => {
    expect(pageCount(24, 12)).toBe(2);
  });

  it("is defensive about junk totals and limits", () => {
    expect(pageCount(-5, 12)).toBe(0);
    expect(pageCount(10, 0)).toBe(10);
    expect(pageCount(Number.NaN, 12)).toBe(0);
  });

  it("agrees with pageWindow on where the last page starts", () => {
    // The two are used together on every list endpoint; if they disagree the
    // final page is either unreachable or empty.
    const total = 37;
    const limit = 12;
    const pages = pageCount(total, limit);
    expect(pages).toBe(4);

    const last = pageWindow(pages, limit);
    expect(last.offset).toBeLessThan(total);
    expect(last.offset + limit).toBeGreaterThanOrEqual(total);
  });
});
