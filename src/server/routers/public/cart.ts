/**
 * Cart Router
 *
 * tRPC router for shopping cart operations.
 * All procedures require authentication (protectedProcedure).
 */

import { router, protectedProcedure } from "../../trpc";
import { container } from "@/application/container";
import { z } from "zod";

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
        quantity: z.number().int().min(1).default(1),
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
        quantity: z.number().int().min(1),
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
    // Release abandoned checkouts before reporting availability, so stock held
    // by an expired payment window is counted as free. Throttled internally.
    await container.getCancelExpiredCheckoutsUseCase().execute();

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
});
