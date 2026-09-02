import { describe, it, expect } from "vitest";
import { formatOrderAddress } from "./order-address";
import type { OrderAddress } from "@/domain/orders/entities/order.entity";

/**
 * The Stripe confirmation email printed the literal string "Address will be
 * confirmed separately" because it was built from the Stripe session rather
 * than from the order. The order carries a resolved `OrderAddress`, so it
 * never needed to.
 */
const address: OrderAddress = {
  fullName: "Nour Hassan",
  addressLine1: "12 Zamalek St",
  addressLine2: "Apt 4",
  city: "Cairo",
  state: "Cairo Governorate",
  postalCode: "11211",
  country: "EG",
  phone: "+201000000000",
};

describe("formatOrderAddress", () => {
  it("renders every populated line in postal order", () => {
    expect(formatOrderAddress(address)).toBe(
      [
        "Nour Hassan",
        "12 Zamalek St",
        "Apt 4",
        "Cairo, Cairo Governorate 11211",
        "EG",
        "+201000000000",
      ].join("\n")
    );
  });

  it("omits an absent second line rather than leaving a blank", () => {
    const formatted = formatOrderAddress({ ...address, addressLine2: null });

    expect(formatted).not.toContain("\n\n");
    expect(formatted).toContain("12 Zamalek St\nCairo,");
  });

  it("does not leave a dangling comma when the state is empty", () => {
    const formatted = formatOrderAddress({ ...address, state: "" });

    expect(formatted).toContain("Cairo 11211");
    expect(formatted).not.toContain("Cairo,");
  });

  it("degrades to a stated placeholder when there is no address", () => {
    expect(formatOrderAddress(null)).toBe("No shipping address on file");
  });
});
