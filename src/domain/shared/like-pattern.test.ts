import { describe, it, expect } from "vitest";
import {
  containsPattern,
  escapeLikeTerm,
  LIKE_ESCAPE_CHAR,
} from "./like-pattern";

describe("escapeLikeTerm", () => {
  it("leaves an ordinary term untouched", () => {
    expect(escapeLikeTerm("hoodie")).toBe("hoodie");
    expect(escapeLikeTerm("Storm Hoodie")).toBe("Storm Hoodie");
  });

  it("escapes the percent wildcard", () => {
    expect(escapeLikeTerm("50%")).toBe("50\\%");
  });

  it("escapes the underscore wildcard", () => {
    expect(escapeLikeTerm("t_e")).toBe("t\\_e");
  });

  it("escapes the escape character itself, and does not double-escape", () => {
    // The backslash must be escaped before the wildcards, or the escapes this
    // function introduces would themselves get escaped on a second pass.
    expect(escapeLikeTerm("a\\b")).toBe("a\\\\b");
    expect(escapeLikeTerm("\\%")).toBe("\\\\\\%");
  });

  it("escapes every occurrence, not just the first", () => {
    expect(escapeLikeTerm("%a%b%")).toBe("\\%a\\%b\\%");
  });

  it("uses the same escape character the SQL clause declares", () => {
    expect(escapeLikeTerm("%")).toBe(`${LIKE_ESCAPE_CHAR}%`);
  });
});

describe("containsPattern", () => {
  it("wraps a term in wildcards", () => {
    expect(containsPattern("hoodie")).toBe("%hoodie%");
  });

  it("trims surrounding whitespace", () => {
    expect(containsPattern("  hoodie  ")).toBe("%hoodie%");
  });

  it("escapes wildcards inside the term but not the ones it adds", () => {
    // This is the whole point: "50%" must match products containing "50%",
    // not every row in the table.
    expect(containsPattern("50%")).toBe("%50\\%%");
  });

  it("returns null for absent or blank input", () => {
    // Distinct from "a search that matches nothing" — the caller reads null as
    // "apply no search filter at all". A blank term becoming `%%` would quietly
    // match the entire catalogue.
    expect(containsPattern(undefined)).toBeNull();
    expect(containsPattern(null)).toBeNull();
    expect(containsPattern("")).toBeNull();
    expect(containsPattern("   ")).toBeNull();
    expect(containsPattern("\t\n")).toBeNull();
  });

  it("keeps a term that is only wildcards, escaped", () => {
    // "%" is a legitimate thing to search for; it must not be read as "match
    // everything", and it must not be treated as blank either.
    expect(containsPattern("%")).toBe("%\\%%");
  });
});
