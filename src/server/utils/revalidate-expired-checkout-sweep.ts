import type { CancelExpiredCheckoutsResult } from "@/application/orders/use-cases/cancel-expired-checkouts.use-case";
import { revalidateCatalogue } from "./revalidate-catalogue";

/** Keep lazy expiry cleanup non-blocking while publishing any returned stock. */
export function revalidateAfterExpiredCheckoutSweep(
  sweep: Promise<CancelExpiredCheckoutsResult>
): void {
  void sweep
    .then((result) => {
      if (result.cancelled > 0) revalidateCatalogue();
    })
    .catch((error) => {
      console.error(
        "[Orders] Failed to settle expired-checkout cache invalidation",
        error instanceof Error ? error.message : error
      );
    });
}
