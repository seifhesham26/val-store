import { describe, expect, it } from "vitest";
import { LEGAL_SLUGS, isLegalSlug } from "./legal-slugs";

describe("legal slugs", () => {
  it("covers exactly the five legal pages", () => {
    expect([...LEGAL_SLUGS].sort()).toEqual([
      "faq",
      "privacy",
      "returns",
      "shipping",
      "terms",
    ]);
  });

  it("accepts a known slug", () => {
    expect(isLegalSlug("returns")).toBe(true);
  });

  it("rejects an unknown slug", () => {
    expect(isLegalSlug("refunds")).toBe(false);
  });

  it("rejects a slug differing only by case", () => {
    expect(isLegalSlug("Returns")).toBe(false);
  });
});
