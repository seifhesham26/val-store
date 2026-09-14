import { describe, expect, it } from "vitest";
import {
  customerContactRevealSchema,
  workerSupportLookupSchema,
} from "./customer-access-input";

describe("workerSupportLookupSchema", () => {
  const valid = {
    email: "customer@example.com",
    confirmedCustomerRequest: true as const,
    reason: "order_status" as const,
  };

  it("accepts an exact email with explicit confirmation and a reason", () => {
    expect(workerSupportLookupSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects partial or malformed email text", () => {
    expect(
      workerSupportLookupSchema.safeParse({ ...valid, email: "customer" })
        .success
    ).toBe(false);
  });

  it("rejects an unchecked customer-request confirmation", () => {
    expect(
      workerSupportLookupSchema.safeParse({
        ...valid,
        confirmedCustomerRequest: false,
      }).success
    ).toBe(false);
  });

  it("rejects admin-only reveal reasons", () => {
    expect(
      workerSupportLookupSchema.safeParse({
        ...valid,
        reason: "account_correction",
      }).success
    ).toBe(false);
  });

  it("requires a short note for other", () => {
    expect(
      workerSupportLookupSchema.safeParse({
        ...valid,
        reason: "other",
        reasonNote: " ",
      }).success
    ).toBe(false);
    expect(
      workerSupportLookupSchema.safeParse({
        ...valid,
        reason: "other",
        reasonNote: "Customer asked about an older order",
      }).success
    ).toBe(true);
  });
});

describe("customerContactRevealSchema", () => {
  it("accepts the approved admin reason set", () => {
    for (const reason of [
      "customer_support",
      "delivery_issue",
      "account_correction",
    ] as const) {
      expect(
        customerContactRevealSchema.safeParse({
          customerId: "customer-1",
          reason,
        }).success
      ).toBe(true);
    }
  });

  it("requires a note for other", () => {
    expect(
      customerContactRevealSchema.safeParse({
        customerId: "customer-1",
        reason: "other",
      }).success
    ).toBe(false);
  });
});
