import { describe, it, expect } from "vitest";
import { safeRedirect, safeHref, DEFAULT_REDIRECT } from "./safe-url";

/**
 * The values both functions must refuse, whatever else they differ on.
 *
 * Shared so a case added for one is automatically asserted for the other —
 * these two drifting apart is the specific failure this file exists to stop.
 */
const OFF_ORIGIN = [
  // Protocol-relative: reads as a path, loads a third party.
  "//evil.example",
  "//evil.example/account",
  // Backslash: a special-scheme URL parser treats it as a slash, so this
  // reaches the authority state exactly like the line above.
  "/\\evil.example",
  "/\\\\evil.example",
  // Tab, newline and carriage return are stripped before parsing, reassembling
  // the "//" that the leading-slash check just accepted.
  "/\t/evil.example",
  "/\n/evil.example",
  "/\r/evil.example",
];

const DANGEROUS_SCHEMES = [
  "javascript:alert(1)",
  "JavaScript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "file:///etc/passwd",
];

describe("safeRedirect", () => {
  describe("allows same-origin paths", () => {
    it.each([
      ["/", "/"],
      ["/account", "/account"],
      ["/admin/products", "/admin/products"],
      ["/collections/all?sort=price", "/collections/all?sort=price"],
      ["/products/tee#reviews", "/products/tee#reviews"],
      ["/account/orders?page=2#top", "/account/orders?page=2#top"],
    ])("keeps %s", (input, expected) => {
      expect(safeRedirect(input)).toBe(expected);
    });
  });

  describe("rejects off-origin destinations", () => {
    it.each(OFF_ORIGIN)("rejects %j", (input) => {
      expect(safeRedirect(input)).toBe(DEFAULT_REDIRECT);
    });

    it.each(DANGEROUS_SCHEMES)("rejects %j", (input) => {
      expect(safeRedirect(input)).toBe(DEFAULT_REDIRECT);
    });

    it.each([
      "https://evil.example",
      "http://evil.example/login",
      // Absolute is absolute. The server cannot verify its own public origin,
      // so it does not try — even for a URL that looks like this site.
      "https://valkyrie.example/account",
    ])("rejects the absolute URL %j", (input) => {
      expect(safeRedirect(input)).toBe(DEFAULT_REDIRECT);
    });

    it.each([
      // No leading slash: would resolve to a path, but is not the shape the
      // parameter is documented to carry.
      "evil.example",
      "account",
      // Browsers would strip the space and follow "//evil.example".
      " //evil.example",
    ])("rejects the non-path %j", (input) => {
      expect(safeRedirect(input)).toBe(DEFAULT_REDIRECT);
    });
  });

  describe("rejects absent values", () => {
    it.each([[null], [undefined], [""]])("rejects %j", (input) => {
      expect(safeRedirect(input)).toBe(DEFAULT_REDIRECT);
    });
  });

  describe("fallback", () => {
    it("defaults to the site root", () => {
      expect(DEFAULT_REDIRECT).toBe("/");
      expect(safeRedirect("https://evil.example")).toBe("/");
    });

    it("uses a caller-supplied fallback when one is given", () => {
      expect(safeRedirect("https://evil.example", "/account")).toBe("/account");
      expect(safeRedirect(null, "/account")).toBe("/account");
    });
  });
});

describe("safeHref", () => {
  describe("allows same-origin paths", () => {
    it.each([
      ["/", "/"],
      ["/collections/all", "/collections/all"],
      ["/collections/all?sort=price#grid", "/collections/all?sort=price#grid"],
    ])("keeps %s", (input, expected) => {
      expect(safeHref(input)).toBe(expected);
    });
  });

  describe("allows absolute http(s) URLs", () => {
    it("keeps an https link", () => {
      expect(safeHref("https://lookbook.example/ss26")).toBe(
        "https://lookbook.example/ss26"
      );
    });

    it("keeps an http link", () => {
      expect(safeHref("http://lookbook.example/ss26")).toBe(
        "http://lookbook.example/ss26"
      );
    });

    it("normalises through the parser", () => {
      expect(safeHref("https://lookbook.example")).toBe(
        "https://lookbook.example/"
      );
    });
  });

  describe("rejects executable schemes", () => {
    // The reason this function exists: React renders a javascript: href as
    // given, and these fields are admin-written strings shown to every visitor.
    it.each(DANGEROUS_SCHEMES)("rejects %j", (input) => {
      expect(safeHref(input)).toBeNull();
    });
  });

  describe("rejects values that only look relative", () => {
    it.each(OFF_ORIGIN)("rejects %j", (input) => {
      expect(safeHref(input)).toBeNull();
    });
  });

  describe("rejects absent and unparseable values", () => {
    it.each([[null], [undefined], [""], ["not a url"], ["  "]])(
      "rejects %j",
      (input) => {
        expect(safeHref(input)).toBeNull();
      }
    );
  });
});
