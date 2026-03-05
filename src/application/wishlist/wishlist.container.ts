/**
 * Wishlist Domain Container
 */

import { DrizzleWishlistRepository } from "@/infrastructure/database/repositories/wishlist.repository";
import { AddToWishlistUseCase } from "./use-cases/add-to-wishlist.use-case";
import { RemoveFromWishlistUseCase } from "./use-cases/remove-from-wishlist.use-case";
import { GetWishlistUseCase } from "./use-cases/get-wishlist.use-case";
import { CheckWishlistStatusUseCase } from "./use-cases/check-wishlist-status.use-case";

export function createWishlistModule() {
  let repo: DrizzleWishlistRepository | undefined;
  const getWishlistRepository = () =>
    (repo ??= new DrizzleWishlistRepository());

  let add: AddToWishlistUseCase | undefined;
  let remove: RemoveFromWishlistUseCase | undefined;
  let get: GetWishlistUseCase | undefined;
  let check: CheckWishlistStatusUseCase | undefined;

  return {
    getWishlistRepository,
    getAddToWishlistUseCase: () =>
      (add ??= new AddToWishlistUseCase(getWishlistRepository())),
    getRemoveFromWishlistUseCase: () =>
      (remove ??= new RemoveFromWishlistUseCase(getWishlistRepository())),
    getGetWishlistUseCase: () =>
      (get ??= new GetWishlistUseCase(getWishlistRepository())),
    getCheckWishlistStatusUseCase: () =>
      (check ??= new CheckWishlistStatusUseCase(getWishlistRepository())),
  };
}

export type WishlistModule = ReturnType<typeof createWishlistModule>;
