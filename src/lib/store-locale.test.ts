import { describe, expect, it } from "vitest";
import { STORE_LOCALE, STORE_TIMEZONE, formatStoreDate } from "./store-locale";

describe("store locale", () => {
  it("defaults to a locale that puts the day before the month", () => {
    // Asserted through behaviour rather than by comparing the tag to a string:
    // any day-first locale is an acceptable default, "en-US" is not.
    const formatted = new Date(Date.UTC(2026, 0, 2)).toLocaleDateString(
      STORE_LOCALE,
      { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }
    );
    expect(formatted.startsWith("02")).toBe(true);
    expect(STORE_LOCALE).not.toBe("en-US");
  });

  it("defaults the timezone to Egypt", () => {
    expect(STORE_TIMEZONE).toBe("Africa/Cairo");
  });

  it("formats an ISO date without shifting the day", () => {
    expect(formatStoreDate("2026-09-09")).toBe("9 September 2026");
  });

  it("formats the first of a month without rolling back", () => {
    expect(formatStoreDate("2026-01-01")).toBe("1 January 2026");
  });

  it("returns the input unchanged when it is not a date", () => {
    expect(formatStoreDate("not-a-date")).toBe("not-a-date");
  });
});
