/**
 * Cart Router
 *
 * tRPC router for shopping cart operations.
 * All procedures require authentication (protectedProcedure).
 */

import { router, protectedProcedure } from "../../trpc";
import { container } from "@/application/container";
import { z } from "zod";

/**
 * Ceiling on a single cart line.
 *
 * The real limit is stock, enforced by `assertWithinStock` in the cart
 * repository, and that is what a customer actually runs into. This is the
 * bound on what the *input* may say at all: without it a request could ask for
 * 2^31 units and the stock check was the only thing standing between that
 * number and arithmetic on an order total. Defence in depth, and cheap.
 */
const MAX_LINE_QUANTITY = 100;

export const cartRouter = router({
  /**
   * Get user's cart
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const useCase = container.getGetCartUseCase();
    return useCase.execute(ctx.user.id);
  }),

  /**
   * Add item to cart
   */
  add: protectedProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY).default(1),
        variantId: z.string().uuid().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const useCase = container.getAddToCartUseCase();
      return useCase.execute({
        userId: ctx.user.id,
        productId: input.productId,
        quantity: input.quantity,
        variantId: input.variantId ?? null,
      });
    }),

  /**
   * Update cart item quantity
   */
  updateQuantity: protectedProcedure
    .input(
      z.object({
        cartItemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const useCase = container.getUpdateCartItemUseCase();
      return useCase.execute({
        cartItemId: input.cartItemId,
        quantity: input.quantity,
        userId: ctx.user.id,
      });
    }),

  /**
   * Remove item from cart
   */
  remove: protectedProcedure
    .input(
      z.object({
        cartItemId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const useCase = container.getRemoveCartItemUseCase();
      return useCase.execute({
        cartItemId: input.cartItemId,
        userId: ctx.user.id,
      });
    }),

  /**
   * Live stock reconciliation for the cart.
   *
   * Cheap enough to call on any interaction: one cart read plus one batched
   * variant read, and a third query only when something is actually wrong.
   */
  stockStatus: protectedProcedure.query(async ({ ctx }) => {
    // Release abandoned checkouts so stock held by an expired payment window
    // comes back into circulation. Deliberately not awaited: this is global
    // housekeeping that asks Stripe about other people's orders, and a shopper
    // checking their cart should not wait for it. The next poll, fifteen
    // seconds later, sees the result. The use case throttles itself and
    // swallows its own errors.
    void container.getCancelExpiredCheckoutsUseCase().execute();

    const useCase = container.getCheckCartStockUseCase();
    return useCase.execute(ctx.user.id);
  }),

  /**
   * Move a cart line onto a different variant of the same product — the
   * "take this colour instead" route out of a stock problem.
   */
  changeVariant: protectedProcedure
    .input(
      z.object({
        cartItemId: z.string().uuid(),
        variantId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const useCase = container.getChangeCartItemVariantUseCase();
      return useCase.execute({
        userId: ctx.user.id,
        cartItemId: input.cartItemId,
        variantId: input.variantId,
      });
    }),

  /**
   * Clear entire cart
   */
  clear: protectedProcedure.mutation(async ({ ctx }) => {
    const useCase = container.getClearCartUseCase();
    return useCase.execute(ctx.user.id);
  }),

  /**
   * Fold a guest's locally-held cart lines into the server cart at sign-in.
   *
   * Only productId/variantId/quantity are accepted — a guest cart can sit in
   * localStorage for days, so its price is stale display state and is never
   * read here. The use case re-resolves both price and stock from the
   * database before writing anything.
   */
  mergeGuestItems: protectedProcedure
    .input(
      z.object({
        items: z
          .array(
            z.object({
              productId: z.string().uuid(),
              variantId: z.string().uuid().nullable(),
              quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
            })
          )
          .max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const useCase = container.getMergeGuestCartItemsUseCase();
      return useCase.execute({
        userId: ctx.user.id,
        items: input.items,
      });
    }),
});
