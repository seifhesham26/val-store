import { CollectionGridSkeleton } from "@/components/products/CollectionGridSkeleton";

/**
 * Shown while any collection route's server component resolves. Without this
 * the App Router blocks the navigation entirely — the customer clicks and the
 * old page simply sits there until the new one is ready.
 */
export default function CollectionsLoading() {
  return <CollectionGridSkeleton />;
}
