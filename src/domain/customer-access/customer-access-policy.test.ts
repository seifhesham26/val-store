import { describe, expect, it } from "vitest";
import {
  canBrowseCustomerDirectory,
  canExportOrders,
  canReviewAccessFor,
  isActiveFulfillmentStatus,
  isHistoricalOrderStatus,
} from "./customer-access-policy";

describe("customer access policy", () => {
  it.each(["pending", "processing", "paid", "shipped"])(
    "treats %s as active fulfilment work",
    (status) => {
      expect(isActiveFulfillmentStatus(status)).toBe(true);
    }
  );

  it.each(["delivered", "cancelled", "refunded", "unknown"])(
    "treats %s as historical or invalid",
    (status) => {
      expect(isActiveFulfillmentStatus(status)).toBe(false);
    }
  );

  it.each(["delivered", "cancelled", "refunded"])(
    "treats %s as historical support work",
    (status) => {
      expect(isHistoricalOrderStatus(status)).toBe(true);
    }
  );

  it.each(["pending", "processing", "paid", "shipped", "unknown"])(
    "does not treat %s as historical support work",
    (status) => {
      expect(isHistoricalOrderStatus(status)).toBe(false);
    }
  );

  it("keeps workers out of the browsable customer directory", () => {
    expect(canBrowseCustomerDirectory("worker")).toBe(false);
    expect(canBrowseCustomerDirectory("admin")).toBe(true);
    expect(canBrowseCustomerDirectory("super_admin")).toBe(true);
    expect(canBrowseCustomerDirectory("customer")).toBe(false);
  });

  it("limits order exports to admins and super admins", () => {
    expect(canExportOrders("worker")).toBe(false);
    expect(canExportOrders("admin")).toBe(true);
    expect(canExportOrders("super_admin")).toBe(true);
    expect(canExportOrders("customer")).toBe(false);
  });

  it("lets a super admin review every staff role", () => {
    expect(canReviewAccessFor("super_admin", "worker")).toBe(true);
    expect(canReviewAccessFor("super_admin", "admin")).toBe(true);
    expect(canReviewAccessFor("super_admin", "super_admin")).toBe(true);
  });

  it("lets an admin request staff history while row-level filtering hides peer-role events", () => {
    expect(canReviewAccessFor("admin", "worker", false)).toBe(true);
    expect(canReviewAccessFor("admin", "admin", true)).toBe(true);
    expect(canReviewAccessFor("admin", "admin", false)).toBe(true);
    expect(canReviewAccessFor("admin", "super_admin", false)).toBe(true);
    expect(canReviewAccessFor("admin", "customer", false)).toBe(false);
  });

  it("lets a worker review only their own events", () => {
    expect(canReviewAccessFor("worker", "worker", true)).toBe(true);
    expect(canReviewAccessFor("worker", "worker", false)).toBe(false);
    expect(canReviewAccessFor("worker", "admin", false)).toBe(false);
  });
});
