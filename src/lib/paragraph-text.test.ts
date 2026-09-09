import { describe, expect, it } from "vitest";
import { joinParagraphs, splitParagraphs } from "./paragraph-text";

describe("splitParagraphs", () => {
  it("splits on blank lines", () => {
    expect(splitParagraphs("First para.\n\nSecond para.")).toEqual([
      "First para.",
      "Second para.",
    ]);
  });

  it("keeps a single newline inside one paragraph", () => {
    // A soft wrap is not a paragraph break. Splitting on every newline would
    // turn a wrapped sentence into two <p> tags.
    expect(splitParagraphs("One line\nstill the same para.")).toEqual([
      "One line\nstill the same para.",
    ]);
  });

  it("tolerates any number of blank lines between paragraphs", () => {
    expect(splitParagraphs("A.\n\n\n\nB.")).toEqual(["A.", "B."]);
  });

  it("tolerates whitespace-only lines as separators", () => {
    expect(splitParagraphs("A.\n   \nB.")).toEqual(["A.", "B."]);
  });

  it("trims each paragraph and drops empty ones", () => {
    expect(splitParagraphs("\n\n  A.  \n\n\n  \n\nB.\n\n")).toEqual([
      "A.",
      "B.",
    ]);
  });

  it("returns an empty array for blank input", () => {
    // Not `[""]` — the schema would strip it anyway, but an empty array is
    // what "the author wrote no body copy" should look like at every layer.
    expect(splitParagraphs("")).toEqual([]);
    expect(splitParagraphs("   \n\n  ")).toEqual([]);
  });

  it("handles CRLF, which is what a Windows paste contains", () => {
    expect(splitParagraphs("A.\r\n\r\nB.")).toEqual(["A.", "B."]);
  });
});

describe("joinParagraphs", () => {
  it("separates with a blank line so the result re-splits identically", () => {
    expect(joinParagraphs(["A.", "B."])).toBe("A.\n\nB.");
  });

  it("round-trips through splitParagraphs", () => {
    // The editor loads with `joinParagraphs` and saves with `splitParagraphs`.
    // Opening a section and saving it without typing must not alter it.
    const original = [
      "First para.",
      "Second para.\nwith a soft wrap.",
      "Third.",
    ];

    expect(splitParagraphs(joinParagraphs(original))).toEqual(original);
  });

  it("returns an empty string for no paragraphs", () => {
    expect(joinParagraphs([])).toBe("");
  });
});
