import { describe, expect, it } from "vitest";
import {
  contentSchemaBySectionType,
  sectionTypeSchema,
  updateContentSectionSchema,
} from "./content-section-input";
import { contentSchemaMap } from "@/domain/site/value-objects/content-schemas";

describe("updateContentSectionSchema", () => {
  it("keeps a promo banner's description", () => {
    // The regression this discriminated union exists to prevent. Under the
    // previous plain `z.union`, this payload matched the brand-story member
    // first — every field it declares is optional there — and `description`
    // was stripped before the handler stringified it into the database.
    const parsed = updateContentSectionSchema.parse({
      sectionType: "promo_banner",
      content: {
        headline: "Sale",
        description: "Selected styles at reduced prices.",
      },
    });

    expect(parsed.content).toMatchObject({
      headline: "Sale",
      description: "Selected styles at reduced prices.",
    });
  });

  it("keeps a brand story's paragraphs", () => {
    const parsed = updateContentSectionSchema.parse({
      sectionType: "brand_story",
      content: {
        headline: "Crafted for the Bold",
        paragraphs: ["One.", "Two."],
      },
    });

    expect(parsed.content).toMatchObject({
      headline: "Crafted for the Bold",
      paragraphs: ["One.", "Two."],
    });
  });

  it("rejects content that does not match the declared section type", () => {
    // An announcement payload sent as a hero. The plain union accepted this
    // because it only asked whether *some* member matched.
    expect(
      updateContentSectionSchema.safeParse({
        sectionType: "hero",
        content: { messages: [{ text: "Free delivery" }] },
      }).success
    ).toBe(false);
  });

  it("rejects an unknown section type", () => {
    expect(
      updateContentSectionSchema.safeParse({
        sectionType: "instagram",
        content: { headline: "x" },
      }).success
    ).toBe(false);
  });

  it("carries displayOrder and isActive through on every variant", () => {
    for (const sectionType of sectionTypeSchema.options) {
      const content =
        sectionType === "announcement"
          ? { messages: [{ text: "Hello" }] }
          : sectionType === "hero"
            ? { title: "Hello" }
            : { headline: "Hello" };

      const parsed = updateContentSectionSchema.parse({
        sectionType,
        content,
        displayOrder: 3,
        isActive: false,
      });

      expect(parsed.displayOrder).toBe(3);
      expect(parsed.isActive).toBe(false);
    }
  });
});

describe("the admin write list and the storefront read list agree", () => {
  it("covers exactly the section types the storefront can render", () => {
    // Two lists, one truth. A type the admin can write but the storefront
    // cannot parse produces a section that saves cleanly and never appears;
    // the reverse produces one that renders but can never be edited.
    expect(sectionTypeSchema.options.slice().sort()).toEqual(
      Object.keys(contentSchemaMap).sort()
    );
  });

  it("maps each section type to the same schema the storefront parses with", () => {
    for (const sectionType of sectionTypeSchema.options) {
      expect(contentSchemaBySectionType[sectionType]).toBe(
        contentSchemaMap[sectionType]
      );
    }
  });
});
