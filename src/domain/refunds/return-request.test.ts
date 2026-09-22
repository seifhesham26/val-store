import { describe, expect, it } from "vitest";

import {
  assertReturnActionAllowed,
  carrierClaimDeadline,
  packageGuidance,
  transitionReturnRequest,
  type ReturnRequestStatus,
} from "./return-request";

describe("return request state", () => {
  it("supports the complete evidence, pickup, inspection, and recording path", () => {
    const path: ReturnRequestStatus[] = [
      "requested",
      "awaiting_customer_evidence",
      "pickup_authorized",
      "pickup_pending",
      "in_transit",
      "received",
      "inspection_pending",
      "awaiting_customer_confirmation",
      "confirmed",
      "recorded",
    ];

    for (let index = 0; index < path.length - 1; index += 1) {
      expect(transitionReturnRequest(path[index], path[index + 1])).toBe(
        path[index + 1]
      );
    }
  });

  it.each([
    "requested",
    "awaiting_customer_evidence",
    "pickup_authorized",
    "pickup_pending",
    "in_transit",
    "received",
    "count_disputed",
    "inspection_pending",
    "awaiting_customer_confirmation",
    "disputed",
    "customer_action_required",
    "evidence_exception",
  ] as const)("allows an admin rejection from %s", (status) => {
    expect(transitionReturnRequest(status, "rejected")).toBe("rejected");
  });

  it.each(["confirmed", "recorded", "rejected"] as const)(
    "does not permit rejection from %s",
    (status) => {
      expect(() => transitionReturnRequest(status, "rejected")).toThrow(
        /cannot transition/i
      );
    }
  );

  it("rejects evidence, proposal, and confirmation actions in the wrong state", () => {
    expect(() =>
      assertReturnActionAllowed("recorded", "attach_customer_evidence")
    ).toThrow(/not allowed/i);
    expect(() =>
      assertReturnActionAllowed("pickup_pending", "save_proposal")
    ).toThrow(/not allowed/i);
    expect(() =>
      assertReturnActionAllowed("received", "confirm_proposal")
    ).toThrow(/not allowed/i);
  });

  it("allows the guarded actions only at their workflow boundaries", () => {
    expect(() =>
      assertReturnActionAllowed(
        "awaiting_customer_evidence",
        "attach_customer_evidence"
      )
    ).not.toThrow();
    expect(() =>
      assertReturnActionAllowed("inspection_pending", "save_proposal")
    ).not.toThrow();
    expect(() =>
      assertReturnActionAllowed(
        "awaiting_customer_confirmation",
        "confirm_proposal"
      )
    ).not.toThrow();
  });

  it("treats three units per package as guidance rather than a hard limit", () => {
    expect(packageGuidance({ itemCount: 7, declaredPackageCount: 1 })).toEqual({
      recommendedPackageCount: 3,
      exceedsRecommendedCapacity: true,
      accepted: true,
    });
  });

  it("opens the carrier investigation for three calendar days", () => {
    expect(carrierClaimDeadline(new Date("2026-09-20T23:30:00.000Z"))).toEqual(
      new Date("2026-09-23T23:30:00.000Z")
    );
  });
});
