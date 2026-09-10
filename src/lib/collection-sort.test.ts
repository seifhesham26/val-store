import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCT_SORT,
  PRODUCT_SORTS,
  parseProductSort,
} from "./collection-sort";

describe("collection sort", () => {
  it("round-trips every advertised option", () => {
    for (const option of PRODUCT_SORTS) {
      expect(parseProductSort(option.value)).toBe(option.value);
    }
  });

  it("gives every option a human label", () => {
    for (const option of PRODUCT_SORTS) {
      expect(option.label.length).toBeGreaterThan(0);
    }
  });

  it("falls back to the default for an unknown value", () => {
    expect(parseProductSort("price-sideways")).toBe(DEFAULT_PRODUCT_SORT);
  });

  it("falls back to the default for null and undefined", () => {
    expect(parseProductSort(null)).toBe(DEFAULT_PRODUCT_SORT);
    expect(parseProductSort(undefined)).toBe(DEFAULT_PRODUCT_SORT);
  });

  it("defaults to newest", () => {
    expect(DEFAULT_PRODUCT_SORT).toBe("newest");
  });
});
