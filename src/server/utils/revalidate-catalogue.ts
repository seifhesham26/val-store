import { revalidateTag } from "next/cache";

/**
 * Announce that something a storefront product card renders has changed.
 *
 * The storefront reads the catalogue through `unstable_cache`, so an edit that
 * is not announced here stays invisible for as long as the TTL — long enough
 * for an admin to conclude the save did not work and press it again.
 *
 * This lives in its own module because it was previously a private helper in
 * the products router, and the routers that also change what a card shows —
 * variants and images — never called anything at all. A product card renders
 * its `primaryImage` and its `variants`, so editing either has exactly the
 * same staleness consequence as editing the product row, and all three now go
 * through this one function.
 *
 * These tags are also what make a long cache TTL safe: the TTL is a backstop,
 * the tags are the actual correctness mechanism. Anything added here that
 * writes catalogue data must call this.
 */
export function revalidateCatalogue(): void {
  revalidateTag("featured-products", "max");
  revalidateTag("all-products", "max");
}
