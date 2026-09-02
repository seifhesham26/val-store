/**
 * Merge Guest Cart Items Use Case
 *
 * Folds a guest's locally-held cart lines into the server cart at sign-in.
 * The guest cart is unvalidated client state — it can sit in localStorage
 * for days — so nothing about it is trusted except which products and
 * variants the customer wanted and how many. Price and stock are re-resolved
 * from the database here, never taken from the client.
 *
 * The actual sum-and-cap rules live in the framework-free
 * `mergeGuestCartItems` (`@/lib/guest-cart-merge`) so they can be unit tested
 * without a database; this use case is just the I/O around it — fetch the
 * current server cart and stock, run the merge, write the result back.
 */

import { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import { ProductVariantRepositoryInterface } from "@/domain/products/interfaces/repositories/product-variant.repository.interface";
import { CartItemEntity } from "@/domain/cart/entities/cart-item.entity";
import {
  mergeGuestCartItems,
  type CartLineIdentity,
  type GuestCartLine,
  type ServerCartLine,
} from "@/lib/guest-cart-merge";

export interface MergeGuestCartItemsInput {
  userId: string;
  items: Array<{
    productId: string;
    variantId: string | null;
    quantity: number;
  }>;
}

export interface MergeGuestCartItemsOutput {
  /** Number of guest lines that survived the merge (summed and stock-capped). */
  mergedCount: number;
}

export class MergeGuestCartItemsUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryInterface,
    private readonly variantRepository: ProductVariantRepositoryInterface
  ) {}

  async execute(
    input: MergeGuestCartItemsInput
  ): Promise<MergeGuestCartItemsOutput> {
    const guestLines: GuestCartLine[] = input.items
      .filter((item) => item.quantity >= 1)
      .map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      }));

    if (guestLines.length === 0) {
      return { mergedCount: 0 };
    }

    const existingItems = await this.cartRepository.findByUserId(input.userId);
    const serverLines: ServerCartLine[] = existingItems.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    }));

    const stockFor = await this.buildStockResolver(guestLines);

    const merged = mergeGuestCartItems(serverLines, guestLines, stockFor);

    for (const line of merged) {
      if (line.existingId) {
        await this.cartRepository.updateQuantity(
          line.existingId,
          line.quantity
        );
      } else {
        // No existing row for this key: addItem inserts fresh rather than
        // merging, since the quantity here is already the final, capped sum.
        await this.cartRepository.addItem(
          new CartItemEntity(
            "",
            input.userId,
            line.productId,
            "",
            0,
            null,
            line.quantity,
            0,
            new Date(),
            new Date(),
            line.variantId
          )
        );
      }
    }

    return { mergedCount: merged.length };
  }

  /**
   * Resolve current stock for every distinct line the guest cart mentions.
   * Variant lines are batch-loaded; variant-less lines fall back to the
   * product's total stock, the same rule the cart repository uses when
   * reading a variant-less line.
   */
  private async buildStockResolver(
    guestLines: GuestCartLine[]
  ): Promise<(line: CartLineIdentity) => number> {
    const variantIds = [
      ...new Set(
        guestLines
          .map((line) => line.variantId)
          .filter((id): id is string => id !== null)
      ),
    ];

    const variants = variantIds.length
      ? await this.variantRepository.findByIds(variantIds)
      : [];
    const variantById = new Map(variants.map((v) => [v.id, v]));

    const productIdsNeedingTotalStock = [
      ...new Set(
        guestLines
          .filter((line) => line.variantId === null)
          .map((line) => line.productId)
      ),
    ];
    const totalStockEntries = await Promise.all(
      productIdsNeedingTotalStock.map(
        async (productId) =>
          [
            productId,
            await this.variantRepository.getTotalStockByProduct(productId),
          ] as const
      )
    );
    const totalStockByProduct = new Map(totalStockEntries);

    return (line: CartLineIdentity): number => {
      if (line.variantId) {
        const variant = variantById.get(line.variantId);
        // A crafted or stale variant id — wrong product, deleted, or since
        // made unavailable — resolves to zero rather than being trusted.
        if (
          !variant ||
          variant.productId !== line.productId ||
          !variant.isAvailable
        ) {
          return 0;
        }
        return variant.stockQuantity;
      }
      return totalStockByProduct.get(line.productId) ?? 0;
    };
  }
}
