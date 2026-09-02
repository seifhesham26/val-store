import { describe, it, expect } from "vitest";
import { PasswordValueObject } from "./password.value-object";

describe("PasswordValueObject", () => {
  describe("validate", () => {
    it("accepts a password that meets every rule", () => {
      const result = PasswordValueObject.validate("Str0ng!Pass");
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("flags a missing uppercase letter", () => {
      const result = PasswordValueObject.validate("str0ng!pass");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Password must contain at least one uppercase letter"
      );
    });

    it("flags a missing lowercase letter", () => {
      const result = PasswordValueObject.validate("STR0NG!PASS");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Password must contain at least one lowercase letter"
      );
    });

    it("flags a missing number", () => {
      const result = PasswordValueObject.validate("Strong!Pass");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Password must contain at least one number"
      );
    });

    it("flags a missing special character", () => {
      const result = PasswordValueObject.validate("Str0ngPass");
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((error) => error.includes("special character"))
      ).toBe(true);
    });

    it("flags a password under 8 characters", () => {
      const result = PasswordValueObject.validate("Str0n!x");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Password must be at least 8 characters long"
      );
    });

    it("accepts a password at exactly the 8-character boundary", () => {
      // "Str0ng!x" is exactly 8 characters and satisfies every other rule -
      // the boundary itself must not be rejected.
      expect("Str0ng!x").toHaveLength(8);
      const result = PasswordValueObject.validate("Str0ng!x");
      expect(result.isValid).toBe(true);
    });

    it("can fail more than one rule at once", () => {
      const result = PasswordValueObject.validate("weak");
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe("strength progression", () => {
    it("scores a short, single-class password as weak", () => {
      // Below 8 characters, so the length check contributes nothing and only
      // the lowercase check can score - 1 point total.
      expect(PasswordValueObject.validate("weak").strength).toBe("weak");
    });

    it("scores a password meeting all four character rules at minimum length as medium", () => {
      // 8-11 chars + upper + lower + number + special = 5 points, the low
      // end of "medium".
      const result = PasswordValueObject.validate("Str0ng!x");
      expect(result.strength).toBe("medium");
    });

    it("scores a long password meeting every rule as strong", () => {
      // >=12 chars adds a second length point on top of the four
      // character-class points (6 total), crossing the ">5" strong
      // threshold without needing the >=16 bonus point.
      const result = PasswordValueObject.validate("Str0ng!Password");
      expect(result.strength).toBe("strong");
    });
  });

  describe("create", () => {
    it("returns a value object for a valid password", () => {
      expect(PasswordValueObject.create("Str0ng!Pass").getValue()).toBe(
        "Str0ng!Pass"
      );
    });

    it("throws with the collected reasons for an invalid password", () => {
      expect(() => PasswordValueObject.create("weak")).toThrow(
        /Password requirements not met/
      );
    });
  });

  describe("equals", () => {
    it("compares by underlying value", () => {
      const a = PasswordValueObject.create("Str0ng!Pass");
      const b = PasswordValueObject.create("Str0ng!Pass");
      const c = PasswordValueObject.create("Different1!");
      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });
  });

  describe("getStrengthPercentage", () => {
    it("maps strength tiers to a percentage", () => {
      expect(
        PasswordValueObject.create("Str0ng!Pass").getStrengthPercentage()
      ).toBeGreaterThan(0);
    });
  });

  describe("getRequirements", () => {
    it("lists five human-readable rules", () => {
      expect(PasswordValueObject.getRequirements()).toHaveLength(5);
    });
  });
});
