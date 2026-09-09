import { describe, expect, it } from "vitest";
import {
  EGYPT_GOVERNORATES,
  isEgyptGovernorate,
  resolveShippingZone,
} from "./egypt-governorates";
import { calculateShippingCost, chargesForShipping } from "./shipping-rate";

describe("EGYPT_GOVERNORATES", () => {
  it("lists all 27 governorates", () => {
    expect(EGYPT_GOVERNORATES).toHaveLength(27);
  });

  it("has unique codes", () => {
    const codes = EGYPT_GOVERNORATES.map((g) => g.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("gives every governorate a zone", () => {
    for (const g of EGYPT_GOVERNORATES) {
      expect(["cairo_giza", "delta", "other"]).toContain(g.zone);
    }
  });
});

describe("resolveShippingZone", () => {
  it("puts Cairo and Giza in their own zone", () => {
    expect(resolveShippingZone("Cairo")).toBe("cairo_giza");
    expect(resolveShippingZone("Giza")).toBe("cairo_giza");
  });

  it("recognises Delta governorates", () => {
    expect(resolveShippingZone("Dakahlia")).toBe("delta");
    expect(resolveShippingZone("Kafr El Sheikh")).toBe("delta");
  });

  it("matches case-insensitively and ignores surrounding space", () => {
    expect(resolveShippingZone("  cairo  ")).toBe("cairo_giza");
  });

  it("matches the Arabic name", () => {
    expect(resolveShippingZone("القاهرة")).toBe("cairo_giza");
  });

  it("falls back to `other` for an unknown value rather than throwing", () => {
    // addresses.state is free text and holds values typed before the dropdown
    // existed. A checkout must not fail over an unfamiliar spelling.
    expect(resolveShippingZone("Nowhere")).toBe("other");
    expect(resolveShippingZone("")).toBe("other");
    expect(resolveShippingZone(null)).toBe("other");
    expect(resolveShippingZone(undefined)).toBe("other");
  });
});

describe("isEgyptGovernorate", () => {
  it("accepts a real governorate", () => {
    expect(isEgyptGovernorate("Luxor")).toBe(true);
  });

  it("rejects a US state", () => {
    expect(isEgyptGovernorate("California")).toBe(false);
  });
});

describe("calculateShippingCost", () => {
  it("is free while no rates are configured, preserving prior behaviour", () => {
    // The store shipped free before this module existed. Installing it must not
    // start charging anyone; that requires setting the env vars deliberately.
    expect(calculateShippingCost({ subtotal: 500, governorate: "Cairo" })).toBe(
      0
    );
    expect(calculateShippingCost({ subtotal: 0, governorate: "Aswan" })).toBe(
      0
    );
  });

  it("never returns a negative charge", () => {
    expect(
      calculateShippingCost({ subtotal: 0, governorate: "Nowhere" })
    ).toBeGreaterThanOrEqual(0);
  });

  it("reports that the store does not charge for shipping yet", () => {
    expect(chargesForShipping()).toBe(false);
  });
});
