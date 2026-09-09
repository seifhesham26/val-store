import { describe, expect, it } from "vitest";
import {
  slugifyHeading,
  splitMarkdownDocument,
  splitMarkdownSections,
} from "./markdown-sections";

describe("slugifyHeading", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyHeading("Your rights under Egyptian law")).toBe(
      "your-rights-under-egyptian-law"
    );
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugifyHeading("Refunds & returns -- how?")).toBe(
      "refunds-returns-how"
    );
  });

  it("falls back rather than returning an empty id", () => {
    expect(slugifyHeading("!!!")).toBe("section");
  });
});

describe("splitMarkdownSections", () => {
  it("splits on h2 and derives an anchor id from each title", () => {
    const out = splitMarkdownSections("## First one\n\na\n\n## Second\n\nb\n");
    expect(out).toEqual([
      { id: "first-one", title: "First one", body: "a" },
      { id: "second", title: "Second", body: "b" },
    ]);
  });

  it("gives duplicate headings distinct ids", () => {
    const out = splitMarkdownSections("## Same\n\na\n\n## Same\n\nb\n");
    expect(out.map((s) => s.id)).toEqual(["same", "same-2"]);
  });

  it("ignores prose before the first heading", () => {
    const out = splitMarkdownSections("intro\n\n## Q\n\na\n");
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Q");
  });

  it("does not split on a ## inside a fenced code block", () => {
    const out = splitMarkdownSections("## Q\n\n```\n## not a heading\n```\n");
    expect(out).toHaveLength(1);
    expect(out[0].body).toContain("## not a heading");
  });

  it("does not split on h3", () => {
    const out = splitMarkdownSections("## Q\n\n### sub\n\na\n");
    expect(out).toHaveLength(1);
    expect(out[0].body).toContain("### sub");
  });

  it("tolerates CRLF", () => {
    const out = splitMarkdownSections("## Q\r\n\r\na\r\n");
    expect(out).toEqual([{ id: "q", title: "Q", body: "a" }]);
  });

  it("returns an empty array when there are no headings", () => {
    expect(splitMarkdownSections("just prose\n")).toEqual([]);
  });
});

describe("splitMarkdownDocument", () => {
  it("keeps the prose above the first heading as the preamble", () => {
    const doc = splitMarkdownDocument("Lead in.\n\nMore lead.\n\n## Q\n\na\n");
    expect(doc.preamble).toBe("Lead in.\n\nMore lead.");
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].title).toBe("Q");
  });

  it("returns an empty preamble when the document opens with a heading", () => {
    const doc = splitMarkdownDocument("## Q\n\na\n");
    expect(doc.preamble).toBe("");
    expect(doc.sections).toHaveLength(1);
  });

  it("does not end the preamble on a ## inside a fence", () => {
    const doc = splitMarkdownDocument(
      "intro\n\n```\n## fake\n```\n\n## Real\n\na\n"
    );
    expect(doc.preamble).toContain("## fake");
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].title).toBe("Real");
  });
});
