import { describe, it, expect } from "vitest";
import {
  generateOrderNumber,
  isOrderNumberCollision,
  ORDER_NUMBER_ALPHABET,
  ORDER_NUMBER_CONSTRAINT,
  ORDER_NUMBER_RANDOM_LENGTH,
} from "./order-number";

/** A deterministic byte source, so the format can be asserted exactly. */
const bytes = (...values: number[]): (() => Uint8Array) => {
  return () => Uint8Array.from(values);
};

const AT = new Date("2026-09-03T14:25:00.000Z");

describe("generateOrderNumber", () => {
  it("has the shape VLK-YYYYMMDD-XXXXXXXX", () => {
    const number = generateOrderNumber(AT);
    expect(number).toMatch(
      new RegExp(`^VLK-\\d{8}-[${ORDER_NUMBER_ALPHABET}]{8}$`)
    );
  });

  it("carries the order's own date", () => {
    expect(generateOrderNumber(AT)).toMatch(/^VLK-20260903-/);
  });

  it("maps bytes onto the alphabet by index", () => {
    const number = generateOrderNumber(AT, bytes(0, 1, 2, 3, 4, 5, 6, 7));
    expect(number).toBe("VLK-20260903-01234567");
  });

  it("wraps a byte above the alphabet back around without bias", () => {
    // 256 is divisible by 32, so `byte % 32` is uniform — that is the whole
    // reason the alphabet is exactly 32 characters long.
    //
    // 32 -> 0, 33 -> 1, 64 -> 0, 255 -> 31, and four zeroes.
    expect(generateOrderNumber(AT, bytes(32, 33, 64, 255, 0, 0, 0, 0))).toBe(
      `VLK-20260903-010${ORDER_NUMBER_ALPHABET[31]}0000`
    );
  });

  it("emits exactly one character per byte", () => {
    // Guards the arithmetic above from an off-by-one that a hand-written
    // expected string would not catch.
    const number = generateOrderNumber(AT, bytes(1, 2, 3, 4, 5, 6, 7, 8));
    expect(number.split("-")[2]).toBe("12345678");
  });

  it("always produces a full-length random part", () => {
    // The old implementation sliced a stringified float, whose length was not
    // guaranteed by construction even though it held up in practice.
    for (let i = 0; i < 500; i++) {
      const randomPart = generateOrderNumber(AT).split("-")[2];
      expect(randomPart).toHaveLength(ORDER_NUMBER_RANDOM_LENGTH);
    }
  });

  it("never emits a character outside the alphabet", () => {
    for (let i = 0; i < 500; i++) {
      for (const char of generateOrderNumber(AT).split("-")[2]) {
        expect(ORDER_NUMBER_ALPHABET).toContain(char);
      }
    }
  });

  it("omits the characters that misread as digits", () => {
    // I/L/O look like 1/1/0 when a customer reads a number to support.
    for (const excluded of ["I", "L", "O", "U"]) {
      expect(ORDER_NUMBER_ALPHABET).not.toContain(excluded);
    }
  });

  it("does not repeat itself across many draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(generateOrderNumber(AT));
    expect(seen.size).toBe(2000);
  });
});

describe("isOrderNumberCollision", () => {
  const collision = {
    code: "23505",
    constraint_name: ORDER_NUMBER_CONSTRAINT,
  };

  it("recognises a duplicate order number", () => {
    expect(isOrderNumberCollision(collision)).toBe(true);
  });

  it("finds it through Drizzle's wrapper", () => {
    // The driver error does not reach the caller directly.
    expect(
      isOrderNumberCollision(
        Object.assign(new Error("Failed query"), { cause: collision })
      )
    ).toBe(true);
  });

  it("finds it two levels down", () => {
    const outer = Object.assign(new Error("outer"), {
      cause: Object.assign(new Error("inner"), { cause: collision }),
    });
    expect(isOrderNumberCollision(outer)).toBe(true);
  });

  it("ignores a unique violation on a different constraint", () => {
    // A duplicate coupon usage is not retryable — retrying would redeem twice.
    expect(
      isOrderNumberCollision({
        code: "23505",
        constraint_name: "coupon_usages_pkey",
      })
    ).toBe(false);
  });

  it("ignores a different error code on the same constraint", () => {
    expect(
      isOrderNumberCollision({
        code: "23503",
        constraint_name: ORDER_NUMBER_CONSTRAINT,
      })
    ).toBe(false);
  });

  it("ignores an out-of-stock failure", () => {
    // The guarded transaction also enforces stock. Retrying that would hide a
    // real answer the customer needs to see.
    expect(
      isOrderNumberCollision(new Error("Not enough stock for Storm Hoodie"))
    ).toBe(false);
  });

  it("survives null, undefined and primitives", () => {
    for (const value of [null, undefined, "boom", 42, false]) {
      expect(isOrderNumberCollision(value)).toBe(false);
    }
  });

  it("terminates on a self-referencing cause chain", () => {
    const looping: { cause?: unknown } = {};
    looping.cause = looping;
    expect(isOrderNumberCollision(looping)).toBe(false);
  });
});
