/**
 * Get Cart Use Case
 *
 * Retrieves all cart items for a user with totals.
 */

import { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import { ValidateCouponUseCase } from "@/application/coupons/use-cases/validate-coupon.use-case";
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
  /** Set only on the read that dropped a coupon, so the UI can say so once. */
  couponRemoved: { code: string; reason: string } | null;
}

export class GetCartUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryInterface,
    private readonly validateCoupon: ValidateCouponUseCase
  ) {}

  async execute(userId: string): Promise<GetCartOutput> {
    const cartItems = await this.cartRepository.findByUserId(userId);

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

    const held = await this.cartRepository.getAppliedCoupon(userId);

    if (held) {
      if (!needsRecheck(held.checkedAt, Date.now())) {
        // Inside the window: trust the last result and issue no extra query.
        appliedCoupon = { code: held.code };
      } else {
        const check = await this.validateCoupon.execute(
          held.code,
          subtotal,
          userId
        );

        if (check.valid) {
          await this.cartRepository.touchCouponCheckedAt(userId);
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
