import { describe, expect, it } from "vitest";
import { parseLegalDocument } from "./legal-frontmatter";

const good = `---
title: Returns & Exchanges
effectiveDate: 2026-09-08
---

## Your right to return

You may return within 14 days.
`;

describe("parseLegalDocument", () => {
  it("reads the title and effective date and returns the body", () => {
    const doc = parseLegalDocument(good);
    expect(doc.title).toBe("Returns & Exchanges");
    expect(doc.effectiveDate).toBe("2026-09-08");
    expect(doc.body).toContain("## Your right to return");
    expect(doc.body.startsWith("---")).toBe(false);
  });

  it("keeps a horizontal rule that appears inside the body", () => {
    const doc = parseLegalDocument(
      `---\ntitle: T\neffectiveDate: 2026-01-01\n---\n\nfirst\n\n---\n\nsecond\n`
    );
    expect(doc.body).toContain("first");
    expect(doc.body).toContain("---");
    expect(doc.body).toContain("second");
  });

  it("tolerates CRLF line endings", () => {
    const doc = parseLegalDocument(good.replace(/\n/g, "\r\n"));
    expect(doc.title).toBe("Returns & Exchanges");
    expect(doc.effectiveDate).toBe("2026-09-08");
  });

  it("rejects a document with no frontmatter rather than treating it as body", () => {
    expect(() => parseLegalDocument("## Just a heading\n")).toThrow(
      /frontmatter/i
    );
  });

  it("rejects an unterminated frontmatter fence", () => {
    expect(() => parseLegalDocument("---\ntitle: T\n")).toThrow(/frontmatter/i);
  });

  it("rejects an unknown key so a typo cannot silently vanish", () => {
    expect(() =>
      parseLegalDocument("---\ntitle: T\neffectivedate: 2026-01-01\n---\n\nx\n")
    ).toThrow(/effectivedate/i);
  });

  it("rejects a missing required key", () => {
    expect(() => parseLegalDocument("---\ntitle: T\n---\n\nx\n")).toThrow(
      /effectiveDate/
    );
  });

  it("rejects an effectiveDate that is not YYYY-MM-DD", () => {
    expect(() =>
      parseLegalDocument("---\ntitle: T\neffectiveDate: 8 Sep 2026\n---\n\nx\n")
    ).toThrow(/effectiveDate/);
  });

  it("rejects an empty body", () => {
    expect(() =>
      parseLegalDocument("---\ntitle: T\neffectiveDate: 2026-01-01\n---\n\n\n")
    ).toThrow(/body/i);
  });
});
