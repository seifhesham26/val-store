export interface QuarantinedOrderItem {
  variantId: string;
  sku: string;
  productName: string;
  variantDetails: string | null;
}

/** Shipping cannot proceed while sellable inventory is under flaw review. */
export class InventoryQuarantineError extends Error {
  readonly name = "InventoryQuarantineError";

  constructor(public readonly items: QuarantinedOrderItem[]) {
    const labels = items.map((item) =>
      item.variantDetails
        ? `${item.productName} (${item.variantDetails}, ${item.sku})`
        : `${item.productName} (${item.sku})`
    );
    super(
      `Shipping is blocked while inventory is under review: ${labels.join(", ")}`
    );
  }
}
