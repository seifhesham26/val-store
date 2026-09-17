import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateCatalogue } = vi.hoisted(() => ({
  revalidateCatalogue: vi.fn(),
}));

vi.mock("./revalidate-catalogue", () => ({ revalidateCatalogue }));

import { revalidateAfterExpiredCheckoutSweep } from "./revalidate-expired-checkout-sweep";

describe("revalidateAfterExpiredCheckoutSweep", () => {
  beforeEach(() => revalidateCatalogue.mockClear());

  it("invalidates only when the sweep returned stock", async () => {
    revalidateAfterExpiredCheckoutSweep(
      Promise.resolve({ cancelled: 2, recovered: 0, skipped: 0 })
    );

    await vi.waitFor(() => expect(revalidateCatalogue).toHaveBeenCalledOnce());
  });

  it("stays quiet when no checkout was cancelled", async () => {
    revalidateAfterExpiredCheckoutSweep(
      Promise.resolve({ cancelled: 0, recovered: 1, skipped: 0 })
    );

    await Promise.resolve();
    expect(revalidateCatalogue).not.toHaveBeenCalled();
  });
});
