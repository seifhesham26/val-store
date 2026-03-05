/**
 * Cart Domain Container
 */

import { DrizzleCartRepository } from "@/infrastructure/database/repositories/cart.repository";
import { AddToCartUseCase } from "./use-cases/add-to-cart.use-case";
import { GetCartUseCase } from "./use-cases/get-cart.use-case";
import { UpdateCartItemUseCase } from "./use-cases/update-cart-item.use-case";
import { RemoveCartItemUseCase } from "./use-cases/remove-cart-item.use-case";
import { ClearCartUseCase } from "./use-cases/clear-cart.use-case";

export function createCartModule() {
  let repo: DrizzleCartRepository | undefined;
  const getCartRepository = () => (repo ??= new DrizzleCartRepository());

  let addToCart: AddToCartUseCase | undefined;
  let getCart: GetCartUseCase | undefined;
  let updateCartItem: UpdateCartItemUseCase | undefined;
  let removeCartItem: RemoveCartItemUseCase | undefined;
  let clearCart: ClearCartUseCase | undefined;

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
  };
}

export type CartModule = ReturnType<typeof createCartModule>;
