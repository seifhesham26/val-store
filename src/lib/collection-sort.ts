/**
 * Collection sort options, in one place.
 *
 * The URL param, the dropdown labels and the repository's `ORDER BY` all read
 * from this list, so adding an option is one edit rather than three that can
 * disagree.
 */

export type ProductSort = "newest" | "price-asc" | "price-desc" | "name";

export const DEFAULT_PRODUCT_SORT: ProductSort = "newest";

export const PRODUCT_SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name", label: "Name: A to Z" },
] as const satisfies readonly { value: ProductSort; label: string }[];

const VALID = new Set<string>(PRODUCT_SORTS.map((option) => option.value));

/**
 * Anything unrecognised becomes the default rather than throwing — this parses
 * a query string a customer can type by hand.
 */
export function parseProductSort(raw: string | null | undefined): ProductSort {
  return raw && VALID.has(raw) ? (raw as ProductSort) : DEFAULT_PRODUCT_SORT;
}
