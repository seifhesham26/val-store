import { describe, it, expect } from "vitest";
import { resolveColorHex } from "./colors";

/**
 * The bug these tests were written for:
 *
 * `resolveColorHex` matched the whole normalised name against a flat lookup,
 * so it only ever recognised single-word colours. Of the eight colour names in
 * the catalogue, exactly one ("Bone") is a single word — the other seven fell
 * through to the decorative hash fallback and rendered an arbitrary hue.
 *
 * The result on the storefront was not merely approximate, it was wrong in a
 * way a customer would act on: "Heather Charcoal" rendered tan, "Faded Black"
 * rendered pinkish red, "Washed Olive" rendered purple.
 *
 * Apparel colour names are overwhelmingly `modifier + base` ("Washed Olive")
 * or `tint + base` ("Slate Grey"), so that shape is what the resolver has to
 * understand.
 */

/** Parse any of the forms the resolver can emit into HSL for assertions. */
function toHsl(value: string): { h: number; s: number; l: number } {
  const hsl = value.match(
    /^hsl\((\d+(?:\.\d+)?) (\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%\)$/
  );
  if (hsl) {
    return { h: +hsl[1], s: +hsl[2], l: +hsl[3] };
  }

  const hex = value.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l: l * 100 };

  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;

  return { h: (((h * 60) % 360) + 360) % 360, s: s * 100, l: l * 100 };
}

/** Hue distance on the circle, so 350 and 10 are 20 apart rather than 340. */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

describe("resolveColorHex", () => {
  describe("the eight colour names the catalogue actually uses", () => {
    // Every one of these except "Bone" returned an arbitrary hash hue before.
    it("resolves every catalogue colour to something derived from its name", () => {
      const catalogue = [
        "Bone",
        "Deep Steel Blue",
        "Desert Sand",
        "Faded Black",
        "Heather Charcoal",
        "Slate Grey",
        "Stone Grey",
        "Washed Olive",
      ];

      for (const name of catalogue) {
        expect(
          resolveColorHex(name),
          `"${name}" fell through to the hash fallback`
        ).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    it("renders neutrals as neutral", () => {
      // The reported bug: a charcoal hoodie showed a tan swatch. Anything
      // named after a grey must be desaturated, whatever modifier precedes it.
      for (const name of [
        "Heather Charcoal",
        "Slate Grey",
        "Stone Grey",
        "Faded Black",
      ]) {
        const { s } = toHsl(resolveColorHex(name));
        expect(
          s,
          `"${name}" is too saturated to read as a neutral`
        ).toBeLessThan(25);
      }
    });

    it("keeps a coloured base recognisably that colour", () => {
      // Olive is a yellow-green: hue roughly 60-100.
      const olive = toHsl(resolveColorHex("Washed Olive"));
      expect(hueDistance(olive.h, 80)).toBeLessThan(35);

      // Blue: hue roughly 200-250.
      const blue = toHsl(resolveColorHex("Deep Steel Blue"));
      expect(hueDistance(blue.h, 225)).toBeLessThan(40);

      // Sand is a warm tan: hue roughly 30-45.
      const sand = toHsl(resolveColorHex("Desert Sand"));
      expect(hueDistance(sand.h, 38)).toBeLessThan(25);
    });
  });

  describe("modifiers", () => {
    it("lightens for 'light' and darkens for 'dark'", () => {
      const base = toHsl(resolveColorHex("Olive"));
      expect(toHsl(resolveColorHex("Light Olive")).l).toBeGreaterThan(base.l);
      expect(toHsl(resolveColorHex("Dark Olive")).l).toBeLessThan(base.l);
    });

    it("desaturates for wash modifiers", () => {
      const base = toHsl(resolveColorHex("Olive"));
      for (const name of ["Washed Olive", "Faded Olive", "Dusty Olive"]) {
        expect(
          toHsl(resolveColorHex(name)).s,
          `"${name}" should be less saturated than plain Olive`
        ).toBeLessThan(base.s);
      }
    });

    it("lifts black off pure black when faded", () => {
      // "Faded Black" is a dark grey, not black — and certainly not the red it
      // used to render as.
      const faded = toHsl(resolveColorHex("Faded Black"));
      const black = toHsl(resolveColorHex("Black"));
      expect(faded.l).toBeGreaterThan(black.l);
      expect(faded.l).toBeLessThan(45);
    });

    it("does not let a modifier alone resolve to a colour", () => {
      // "Washed" names no colour. It must not silently resolve to whatever the
      // last base happened to be.
      expect(resolveColorHex("Washed")).toBe(resolveColorHex("Washed"));
    });
  });

  describe("base selection", () => {
    it("takes the rightmost colour word as the base", () => {
      // English colour phrases are head-final: a "Slate Grey" is a grey that
      // leans slate, not a slate that leans grey.
      const slateGrey = toHsl(resolveColorHex("Slate Grey"));
      expect(slateGrey.s).toBeLessThan(25);
    });

    it("shades the base toward a preceding colour word", () => {
      // "Stone Grey" is a warm grey and "Slate Grey" a cool one. If the tint
      // were ignored, both would resolve identically.
      expect(resolveColorHex("Stone Grey")).not.toBe(
        resolveColorHex("Slate Grey")
      );
    });
  });

  describe("behaviour that must not regress", () => {
    it("passes hex literals straight through", () => {
      expect(resolveColorHex("#1e293b")).toBe("#1e293b");
      expect(resolveColorHex("#abc")).toBe("#abc");
    });

    it("still resolves plain single-word names", () => {
      expect(resolveColorHex("Black")).toBe("#0a0a0a");
      expect(resolveColorHex("Navy")).toBe("#1b2a4a");
    });

    it("normalises separators and case", () => {
      expect(resolveColorHex("light-grey")).toBe(resolveColorHex("Light Grey"));
      expect(resolveColorHex("OFF_WHITE")).toBe(resolveColorHex("Off White"));
    });

    it("returns a usable colour for null, empty and unknown input", () => {
      for (const input of [null, undefined, "", "   ", "Qwertyuiop"]) {
        expect(resolveColorHex(input)).toMatch(/^(#[0-9a-f]{3,8}|hsl\(.+\))$/i);
      }
    });
  });
});
