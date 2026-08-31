import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Outer Wear")).toBe("outer-wear");
  });

  it("joins across an apostrophe rather than breaking on it", () => {
    // The reported bug: "Men's Tee" produced "men-s-tee".
    expect(slugify("Men's Tee")).toBe("mens-tee");
    expect(slugify("Men\u2019s Tee")).toBe("mens-tee");
  });

  it("folds accents to their base letter", () => {
    expect(slugify("Café Collection")).toBe("cafe-collection");
  });

  it("collapses runs of punctuation and whitespace to one hyphen", () => {
    expect(slugify("Tees  &  Tanks")).toBe("tees-tanks");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  -- Sale! -- ")).toBe("sale");
  });

  it("keeps digits", () => {
    expect(slugify("Season 2 Drop")).toBe("season-2-drop");
  });

  it("returns an empty string when nothing survives", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("   ")).toBe("");
  });
});
