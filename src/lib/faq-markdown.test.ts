import { describe, expect, it } from "vitest";

import { splitFaqSections } from "./faq-markdown";

describe("splitFaqSections", () => {
  it("splits on h2 headings", () => {
    const sections = splitFaqSections(
      "## How long do I have?\n\n14 days.\n\n## Who pays?\n\nYou do.\n"
    );
    expect(sections).toEqual([
      { question: "How long do I have?", answer: "14 days." },
      { question: "Who pays?", answer: "You do." },
    ]);
  });

  it("keeps multi-paragraph answers intact", () => {
    const sections = splitFaqSections("## Q\n\nfirst\n\nsecond\n");
    expect(sections).toEqual([{ question: "Q", answer: "first\n\nsecond" }]);
  });

  it("ignores prose before the first heading", () => {
    const sections = splitFaqSections("intro text\n\n## Q\n\na\n");
    expect(sections).toEqual([{ question: "Q", answer: "a" }]);
  });

  it("does not split on h3 or on a bold line that looks like a heading", () => {
    const sections = splitFaqSections(
      "## Q\n\n### sub\n\na\n\n**not a heading**\n"
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].answer).toContain("### sub");
    expect(sections[0].answer).toContain("**not a heading**");
  });

  it("does not treat a ## inside a fenced code block as a heading", () => {
    const sections = splitFaqSections("## Q\n\n```\n## not a heading\n```\n");
    expect(sections).toHaveLength(1);
  });

  it("returns an empty array for markdown with no headings", () => {
    expect(splitFaqSections("just prose\n")).toEqual([]);
  });
});
