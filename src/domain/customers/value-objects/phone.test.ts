import { describe, it, expect } from "vitest";
import { PhoneValueObject } from "./phone.value-object";

/**
 * `looksLikePhone` decides which lookup the sign-in path attempts. It is a
 * heuristic and cannot be wrong in a way that grants access — a bad guess ends
 * in a failed sign-in — but it can be wrong in a way that makes a legitimate
 * identifier unusable, which is what these cover.
 */
describe("PhoneValueObject.looksLikePhone", () => {
  it.each([
    "01012345678", // Egyptian mobile, national format
    "+201012345678", // E.164
    "+20 101 234 5678", // spaced
    "010-1234-5678", // hyphenated
    "(010) 1234 5678", // bracketed
    "1234567",
  ])("treats %j as a phone", (value) => {
    expect(PhoneValueObject.looksLikePhone(value)).toBe(true);
  });

  it.each([
    "user@example.com",
    // The giveaway is the @, even when the local part is all digits.
    "01012345678@example.com",
    "john.doe@valkyrie.example",
    "",
    "notaphone",
    // Too few digits to be a subscriber number.
    "abc123",
    "12345",
    // Enough digits, but mostly not digits.
    "order VLK-20260101-000001",
  ])("does not treat %j as a phone", (value) => {
    expect(PhoneValueObject.looksLikePhone(value)).toBe(false);
  });

  it("does not divide by zero on an empty string", () => {
    // The ratio test would be 0/0 = NaN without the length guard, and NaN > 0.7
    // is false, so this passed by accident before. Now it is intentional.
    expect(PhoneValueObject.looksLikePhone("")).toBe(false);
  });
});

describe("PhoneValueObject.toE164", () => {
  it("normalises an Egyptian national number by default", () => {
    expect(PhoneValueObject.toE164("01012345678")).toBe("+201012345678");
  });

  it("normalises formatting variants to the same value", () => {
    const canonical = PhoneValueObject.toE164("01012345678");
    expect(PhoneValueObject.toE164("010 1234 5678")).toBe(canonical);
    expect(PhoneValueObject.toE164("010-1234-5678")).toBe(canonical);
    expect(PhoneValueObject.toE164("+20 101 234 5678")).toBe(canonical);
  });

  it("returns null rather than throwing on an unparseable value", () => {
    expect(PhoneValueObject.toE164("not a phone")).toBeNull();
    expect(PhoneValueObject.toE164("")).toBeNull();
    expect(PhoneValueObject.toE164("123")).toBeNull();
  });
});
