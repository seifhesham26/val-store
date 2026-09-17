import { describe, expect, it } from "vitest";
import {
  getInventoryCategoryLabel,
  getInventoryInspectionLabel,
  requiresDecisionExplanation,
} from "./inventory-work-ui";

describe("inventory work UI policy", () => {
  it.each([
    ["damaged", "Damaged"],
    ["missing", "Missing"],
    ["extra", "Extra"],
  ] as const)("labels %s requests as %s", (category, expected) => {
    expect(getInventoryCategoryLabel(category)).toBe(expected);
  });

  it.each([
    ["pending", "Inspection pending"],
    ["all_fine", "Checked - all fine"],
    ["flaw_reported", "Flaw reported"],
  ] as const)("labels %s inspections as %s", (status, expected) => {
    expect(getInventoryInspectionLabel(status)).toBe(expected);
  });

  it("requires a reason for rejection or a corrected approval", () => {
    expect(
      requiresDecisionExplanation({
        decision: "rejected",
        requestedQuantity: 2,
        approvedQuantity: null,
      })
    ).toBe(true);
    expect(
      requiresDecisionExplanation({
        decision: "approved",
        requestedQuantity: 2,
        approvedQuantity: 1,
      })
    ).toBe(true);
    expect(
      requiresDecisionExplanation({
        decision: "approved",
        requestedQuantity: 2,
        approvedQuantity: 2,
      })
    ).toBe(false);
  });
});
