import { describe, it, expect } from "vitest";
import { CategorySlug } from "./category-slug.value-object";

describe("CategorySlug", () => {
  describe("fromName", () => {
    it("derives a slug from a display name", () => {
      expect(CategorySlug.fromName("Men's Tee").getValue()).toBe("mens-tee");
    });

    it("throws when the name yields nothing usable", () => {
      expect(() => CategorySlug.fromName("###")).toThrow();
    });
  });

  describe("create", () => {
    it("accepts an already-valid slug", () => {
      expect(CategorySlug.create("mens-tee").getValue()).toBe("mens-tee");
    });

    it("normalizes case and surrounding whitespace", () => {
      expect(CategorySlug.create("  Mens-Tee  ").getValue()).toBe("mens-tee");
    });

    it("rejects a slug with punctuation, spaces or edge hyphens", () => {
      expect(() => CategorySlug.create("men's-tee")).toThrow();
      expect(() => CategorySlug.create("mens tee")).toThrow();
      expect(() => CategorySlug.create("-mens-tee")).toThrow();
      expect(() => CategorySlug.create("mens--tee")).toThrow();
    });
  });

  it("compares by value", () => {
    expect(
      CategorySlug.fromName("Men's Tee").equals(CategorySlug.create("mens-tee"))
    ).toBe(true);
  });
});
