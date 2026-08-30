/**
 * Check Cart Stock Use Case
 *
 * Reconciles what is sitting in the cart against what is actually on the shelf,
 * right now.
 *
 * Stock was previously only checked at the two ends of the journey — when an
 * item was added, and again inside the order transaction. Anything that moved
 * in between (another customer buying the last one, an admin adjustment, a
 * variant being withdrawn) stayed invisible until the customer pressed the
 * final button. This is the check for the middle of the journey.
 *
 * For any line that cannot be fulfilled it also gathers the sibling variants
 * that *can* be, so the customer is offered a way forward rather than just a
 * refusal.
 */

import { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import { ProductVariantRepositoryInterface } from "@/domain/products/interfaces/repositories/product-variant.repository.interface";

/**
 * - `ok`          — the requested quantity can be supplied.
 * - `reduced`     — some are left, but fewer than the cart asks for.
 * - `unavailable` — none are left, or the variant has been withdrawn.
 */
export type CartStockStatus = "ok" | "reduced" | "unavailable";

/** A sibling variant of the same product that is actually in stock. */
export interface CartStockAlternative {
  variantId: string;
  label: string;
  size: string | null;
  color: string | null;
  available: number;
  /** Same size as the customer chose — usually the closest substitute. */
  sameSize: boolean;
  /** Same colour as the customer chose. */
  sameColor: boolean;
}

export interface CartStockLine {
  cartItemId: string;
  productId: string;
  productName: string;
  productImage: string | null;
  variantId: string | null;
  variantLabel: string | null;
  /** Quantity currently in the cart. */
  requested: number;
  /** Units that can actually be supplied. */
  available: number;
  status: CartStockStatus;
  /** Only populated for lines that are not `ok`. */
  alternatives: CartStockAlternative[];
}

export interface CheckCartStockOutput {
  lines: CartStockLine[];
  hasProblems: boolean;
  /** Server time of the check, so the client can show how fresh this is. */
  checkedAt: string;
}

/** Enough to offer a real choice without turning the dialog into a catalogue. */
const MAX_ALTERNATIVES = 6;

export class CheckCartStockUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryInterface,
    private readonly variantRepository: ProductVariantRepositoryInterface
  ) {}

  async execute(userId: string): Promise<CheckCartStockOutput> {
    const checkedAt = new Date().toISOString();
    const items = await this.cartRepository.findByUserId(userId);

    if (items.length === 0) {
      return { lines: [], hasProblems: false, checkedAt };
    }

    const variantIds = items
      .map((item) => item.variantId)
      .filter((id): id is string => id !== null);

    const variants =
      variantIds.length > 0
        ? await this.variantRepository.findByIds(variantIds)
        : [];
    const variantById = new Map(variants.map((v) => [v.id, v]));

    const lines: CartStockLine[] = items.map((item) => {
      const variant = item.variantId
        ? (variantById.get(item.variantId) ?? null)
        : null;

      // A variant line whose row has been deleted or withdrawn from sale is
      // unbuyable regardless of what the cached ceiling said. Lines with no
      // variant fall back to the product's total stock, which the cart
      // repository already resolves.
      const available = item.variantId
        ? variant && variant.isAvailable
          ? variant.stockQuantity
          : 0
        : item.maxStock;

      const status: CartStockStatus =
        available <= 0
          ? "unavailable"
          : item.quantity > available
            ? "reduced"
            : "ok";

      return {
        cartItemId: item.id,
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        variantId: item.variantId,
        variantLabel: item.getVariantLabel(),
        requested: item.quantity,
        available,
        status,
        alternatives: [],
      };
    });

    const problemLines = lines.filter((line) => line.status !== "ok");
    if (problemLines.length === 0) {
      return { lines, hasProblems: false, checkedAt };
    }

    // Only load siblings for products that actually have a problem — in the
    // common case this query never runs at all.
    const productIds = [...new Set(problemLines.map((l) => l.productId))];
    const siblingsByProduct =
      await this.variantRepository.findByProducts(productIds);

    for (const line of problemLines) {
      const item = items.find((i) => i.id === line.cartItemId);
      const wantedSize = item?.variantSize ?? null;
      const wantedColor = item?.variantColor ?? null;

      line.alternatives = (siblingsByProduct.get(line.productId) ?? [])
        .filter((v) => v.id !== line.variantId && v.isInStock())
        .map((v) => ({
          variantId: v.id,
          label: v.getDisplayName(),
          size: v.size,
          color: v.color,
          available: v.stockQuantity,
          sameSize: wantedSize !== null && v.size === wantedSize,
          sameColor: wantedColor !== null && v.color === wantedColor,
        }))
        // Same size in another colour is the nearest thing to what they wanted,
        // so it leads; then the same colour in another size; then whatever has
        // the most stock.
        .sort(
          (a, b) =>
            Number(b.sameSize) - Number(a.sameSize) ||
            Number(b.sameColor) - Number(a.sameColor) ||
            b.available - a.available
        )
        .slice(0, MAX_ALTERNATIVES);
    }

    return { lines, hasProblems: true, checkedAt };
  }
}
