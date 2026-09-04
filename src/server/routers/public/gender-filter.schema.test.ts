import { describe, it, expect } from "vitest";
import { genderFilterSchema } from "./gender-filter.schema";

describe("genderFilterSchema", () => {
  it("accepts each value the gender column actually holds", () => {
    for (const value of ["men", "women", "unisex", "kids"]) {
      expect(genderFilterSchema.safeParse(value)).toMatchObject({
        success: true,
        data: value,
      });
    }
  });

  it("accepts undefined — the filter is optional", () => {
    expect(genderFilterSchema.safeParse(undefined)).toMatchObject({
      success: true,
      data: undefined,
    });
  });

  it("rejects an arbitrary string instead of letting it reach the enum column", () => {
    // Before this schema existed, `gender: "foo"` was cast unchecked onto
    // `products.gender` and Postgres threw `invalid input value for enum`
    // — a 500 where this should be a clean 400.
    const result = genderFilterSchema.safeParse("foo");
    expect(result.success).toBe(false);
  });

  it("rejects a near-miss value (case, plural, empty string)", () => {
    for (const value of ["Men", "mens", "", "MEN"]) {
      expect(genderFilterSchema.safeParse(value).success).toBe(false);
    }
  });
});
