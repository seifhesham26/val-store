/**
 * Cart Domain Container
 */

import { DrizzleCartRepository } from "@/infrastructure/database/repositories/cart/cart.repository";
import { ProductVariantRepositoryInterface } from "@/domain/products/interfaces/repositories/product-variant.repository.interface";
import { AddToCartUseCase } from "./use-cases/add-to-cart.use-case";
import { GetCartUseCase } from "./use-cases/get-cart.use-case";
import { UpdateCartItemUseCase } from "./use-cases/update-cart-item.use-case";
import { RemoveCartItemUseCase } from "./use-cases/remove-cart-item.use-case";
import { ClearCartUseCase } from "./use-cases/clear-cart.use-case";
import { CheckCartStockUseCase } from "./use-cases/check-cart-stock.use-case";
import { ChangeCartItemVariantUseCase } from "./use-cases/change-cart-item-variant.use-case";
import { MergeGuestCartItemsUseCase } from "./use-cases/merge-guest-cart-items.use-case";

/**
 * Reconciling the cart against live stock needs the variant repository, which
 * belongs to the products module. Taken as a dependency rather than imported
 * directly, the same way checkout takes its cart and order repositories.
 */
export interface CartModuleDeps {
  getProductVariantRepository: () => ProductVariantRepositoryInterface;
}

export function createCartModule(deps: CartModuleDeps) {
  let repo: DrizzleCartRepository | undefined;
  const getCartRepository = () => (repo ??= new DrizzleCartRepository());

  let addToCart: AddToCartUseCase | undefined;
  let getCart: GetCartUseCase | undefined;
  let updateCartItem: UpdateCartItemUseCase | undefined;
  let removeCartItem: RemoveCartItemUseCase | undefined;
  let clearCart: ClearCartUseCase | undefined;
  let checkCartStock: CheckCartStockUseCase | undefined;
  let changeCartItemVariant: ChangeCartItemVariantUseCase | undefined;
  let mergeGuestCartItems: MergeGuestCartItemsUseCase | undefined;

  return {
    getCartRepository,
    getAddToCartUseCase: () =>
      (addToCart ??= new AddToCartUseCase(getCartRepository())),
    getGetCartUseCase: () =>
      (getCart ??= new GetCartUseCase(getCartRepository())),
    getUpdateCartItemUseCase: () =>
      (updateCartItem ??= new UpdateCartItemUseCase(getCartRepository())),
    getRemoveCartItemUseCase: () =>
      (removeCartItem ??= new RemoveCartItemUseCase(getCartRepository())),
    getClearCartUseCase: () =>
      (clearCart ??= new ClearCartUseCase(getCartRepository())),
    getCheckCartStockUseCase: () =>
      (checkCartStock ??= new CheckCartStockUseCase(
        getCartRepository(),
        deps.getProductVariantRepository()
      )),
    getChangeCartItemVariantUseCase: () =>
      (changeCartItemVariant ??= new ChangeCartItemVariantUseCase(
        getCartRepository(),
        deps.getProductVariantRepository()
      )),
    getMergeGuestCartItemsUseCase: () =>
      (mergeGuestCartItems ??= new MergeGuestCartItemsUseCase(
        getCartRepository(),
        deps.getProductVariantRepository()
      )),
  };
}

export type CartModule = ReturnType<typeof createCartModule>;
