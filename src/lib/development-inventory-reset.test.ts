import { describe, expect, it } from "vitest";
import {
  assertDevelopmentResetAllowed,
  getDevelopmentResetMode,
} from "./development-inventory-reset";
import { DEVELOPMENT_SEED_STOCK_QUANTITY } from "./seed-inventory";

describe("development inventory reset", () => {
  it("defaults to a dry run and only applies with --apply", () => {
    expect(getDevelopmentResetMode([])).toBe("dry-run");
    expect(getDevelopmentResetMode(["--apply"])).toBe("apply");
  });

  it("refuses every mode in production", () => {
    expect(() => assertDevelopmentResetAllowed("production")).toThrow(
      "NODE_ENV=production"
    );
    expect(() => assertDevelopmentResetAllowed("development")).not.toThrow();
  });

  it("keeps development seed stock at zero", () => {
    expect(DEVELOPMENT_SEED_STOCK_QUANTITY).toBe(0);
  });
});
