/**
 * Get Cart Use Case
 *
 * Retrieves all cart items for a user with totals.
 */

import { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import {
  ValidateCouponUseCase,
  isTransientCouponRejection,
} from "@/application/coupons/use-cases/validate-coupon.use-case";
import { needsRecheck } from "@/lib/cart-coupon-freshness";

export interface CartItemDto {
  id: string;
  productId: string;
  variantId: string | null;
  variantLabel: string | null;
  productName: string;
  productPrice: number;
  productImage: string | null;
  quantity: number;
  maxStock: number;
  subtotal: number;
  canIncrease: boolean;
  canDecrease: boolean;
}

export interface GetCartOutput {
  items: CartItemDto[];
  subtotal: number;
  itemCount: number;
  isEmpty: boolean;
  /** The coupon the cart is holding, if it is still good. */
  appliedCoupon: { code: string } | null;
  /**
   * Set by the read that performed the drop, and null on every later read.
   * Not a delivery guarantee: two concurrent reads can both drop and both
   * report, and a cached response can be replayed to the UI more than once.
   */
  couponRemoved: { code: string; reason: string } | null;
}

export class GetCartUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryInterface,
    private readonly validateCoupon: ValidateCouponUseCase
  ) {}

  async execute(userId: string): Promise<GetCartOutput> {
    // Two independent reads. Issued without an `await` between them so
    // postgres.js pipelines both down one connection — a round trip is the
    // unit of cost here, and this is the query the cart provider runs on
    // mount and after every mutation.
    const itemsQuery = this.cartRepository.findByUserId(userId);
    const heldQuery = this.cartRepository.getAppliedCoupon(userId);
    const [cartItems, held] = await Promise.all([itemsQuery, heldQuery]);

    const items: CartItemDto[] = cartItems.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      variantLabel: item.getVariantLabel(),
      productName: item.productName,
      productPrice: item.productPrice,
      productImage: item.productImage,
      quantity: item.quantity,
      maxStock: item.maxStock,
      subtotal: item.calculateSubtotal(),
      canIncrease: item.canIncrease(),
      canDecrease: item.canDecrease(),
    }));

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    let appliedCoupon: { code: string } | null = null;
    let couponRemoved: { code: string; reason: string } | null = null;

    if (held) {
      if (subtotal <= 0) {
        // Nothing to price, so this read is not evidence about the coupon:
        // a minimum-purchase rule would reject any code against an empty
        // cart. Keep it, and leave `checkedAt` alone so the next read with
        // contents in the cart does a real check.
        appliedCoupon = { code: held.code };
      } else if (!needsRecheck(held.checkedAt, Date.now())) {
        // Inside the window: trust the last result and issue no extra query.
        appliedCoupon = { code: held.code };
      } else {
        try {
          const check = await this.validateCoupon.execute(
            held.code,
            subtotal,
            userId
          );

          if (check.valid) {
            await this.cartRepository.touchCouponCheckedAt(userId);
            appliedCoupon = { code: held.code };
          } else if (isTransientCouponRejection(check.reason)) {
            // The rejection describes the cart, not the coupon — the code is
            // alive and will validate again once the cart changes. Dropping
            // it here would be irreversible for a problem that is not the
            // coupon's. `checkedAt` stays stale so the next read re-checks,
            // and checkout prices against the real order subtotal anyway.
            appliedCoupon = { code: held.code };
          } else {
            // Dropped, and the customer is told which code and why rather than
            // finding a smaller discount than they expected at checkout.
            await this.cartRepository.clearAppliedCoupon(userId);
            couponRemoved = {
              code: held.code,
              reason: check.error ?? "That code can no longer be used.",
            };
          }
        } catch (error) {
          // The re-check is a courtesy, not the cart. A failure here must not
          // take the cart page down with it: keep the coupon, leave
          // `checkedAt` stale so the next read tries again, and say nothing
          // to the customer. Checkout validates for real regardless.
          console.error(
            "[Cart] coupon re-check failed:",
            error instanceof Error ? error.message : String(error)
          );
          appliedCoupon = { code: held.code };
        }
      }
    }

    return {
      items,
      subtotal,
      itemCount,
      isEmpty: items.length === 0,
      appliedCoupon,
      couponRemoved,
    };
  }
}
