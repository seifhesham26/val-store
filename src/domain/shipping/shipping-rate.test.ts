import { describe, expect, it } from "vitest";
import {
  EGYPT_GOVERNORATES,
  isEgyptGovernorate,
  resolveGovernorateCode,
  resolveShippingZone,
} from "./egypt-governorates";
import { quoteShipping, type GovernorateRate } from "./shipping-rate";

const rates: GovernorateRate[] = [
  { governorate: "cairo", fee: 60, isDeliverable: true },
  { governorate: "giza", fee: 60, isDeliverable: true },
  { governorate: "aswan", fee: 120, isDeliverable: true },
  { governorate: "new-valley", fee: 0, isDeliverable: false },
  { governorate: "matrouh", fee: 0, isDeliverable: true },
];

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

describe("resolveGovernorateCode", () => {
  it("resolves the English name a saved address stores", () => {
    expect(resolveGovernorateCode("Cairo")).toBe("cairo");
    expect(resolveGovernorateCode("Kafr El Sheikh")).toBe("kafr-el-sheikh");
  });

  it("resolves a code, the Arabic name, and ignores case and spacing", () => {
    expect(resolveGovernorateCode("aswan")).toBe("aswan");
    expect(resolveGovernorateCode("  CAIRO ")).toBe("cairo");
    expect(resolveGovernorateCode("القاهرة")).toBe("cairo");
  });

  it("returns null for anything it cannot identify", () => {
    expect(resolveGovernorateCode("California")).toBeNull();
    expect(resolveGovernorateCode("")).toBeNull();
    expect(resolveGovernorateCode(null)).toBeNull();
  });
});

describe("resolveShippingZone", () => {
  it("groups Cairo and Giza, the Delta, and everywhere else", () => {
    expect(resolveShippingZone("Cairo")).toBe("cairo_giza");
    expect(resolveShippingZone("Dakahlia")).toBe("delta");
    expect(resolveShippingZone("Aswan")).toBe("other");
  });

  it("falls back to `other` rather than throwing", () => {
    expect(resolveShippingZone("Nowhere")).toBe("other");
  });
});

describe("isEgyptGovernorate", () => {
  it("accepts a real governorate and rejects a US state", () => {
    expect(isEgyptGovernorate("Luxor")).toBe(true);
    expect(isEgyptGovernorate("California")).toBe(false);
  });
});

describe("quoteShipping", () => {
  const base = { rates, freeShippingThreshold: 0 };

  it("charges the configured fee for the destination", () => {
    const q = quoteShipping({ ...base, subtotal: 500, governorate: "Cairo" });
    expect(q.fee).toBe(60);
    expect(q.isDeliverable).toBe(true);
    expect(q.matched).toBe(true);
  });

  it("prices each governorate independently", () => {
    expect(
      quoteShipping({ ...base, subtotal: 500, governorate: "Aswan" }).fee
    ).toBe(120);
  });

  it("waives the fee once the subtotal reaches the threshold", () => {
    const q = quoteShipping({
      rates,
      freeShippingThreshold: 1000,
      subtotal: 1000,
      governorate: "Aswan",
    });
    expect(q.fee).toBe(0);
    expect(q.freeReason).toBe("threshold");
  });

  it("still charges just below the threshold", () => {
    const q = quoteShipping({
      rates,
      freeShippingThreshold: 1000,
      subtotal: 999.99,
      governorate: "Aswan",
    });
    expect(q.fee).toBe(120);
    expect(q.freeReason).toBeNull();
  });

  it("treats a zero threshold as no threshold, not as everything free", () => {
    // The dangerous reading: clearing the field must not give away every
    // delivery in the store.
    const q = quoteShipping({
      rates,
      freeShippingThreshold: 0,
      subtotal: 1_000_000,
      governorate: "Cairo",
    });
    expect(q.fee).toBe(60);
  });

  it("reports a governorate the store does not deliver to", () => {
    const q = quoteShipping({
      ...base,
      subtotal: 500,
      governorate: "New Valley",
    });
    expect(q.isDeliverable).toBe(false);
  });

  it("distinguishes a free destination from an undeliverable one", () => {
    // Both cost nothing; only one of them can be ordered.
    const free = quoteShipping({
      ...base,
      subtotal: 10,
      governorate: "Matrouh",
    });
    expect(free.fee).toBe(0);
    expect(free.isDeliverable).toBe(true);
    expect(free.freeReason).toBe("zero_rate");
  });

  it("does not block or invent a charge for an unrecognised address", () => {
    // addresses.state is free text and holds values saved before the dropdown
    // existed. Refusing the order would punish the customer for old data, and
    // guessing a fee would overcharge them, so it ships free and says it did
    // not match.
    const q = quoteShipping({
      ...base,
      subtotal: 500,
      governorate: "Atlantis",
    });
    expect(q.fee).toBe(0);
    expect(q.isDeliverable).toBe(true);
    expect(q.matched).toBe(false);
  });

  it("does not blow up when a governorate has no configured row yet", () => {
    const q = quoteShipping({
      rates: [],
      freeShippingThreshold: 0,
      subtotal: 500,
      governorate: "Cairo",
    });
    expect(q.fee).toBe(0);
    expect(q.isDeliverable).toBe(true);
  });

  it("never returns a negative fee", () => {
    const q = quoteShipping({
      rates: [{ governorate: "cairo", fee: -50, isDeliverable: true }],
      freeShippingThreshold: 0,
      subtotal: 100,
      governorate: "Cairo",
    });
    expect(q.fee).toBe(0);
  });
});
