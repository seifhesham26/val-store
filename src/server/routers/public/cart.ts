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
   * Clear entire cart
   */
  clear: protectedProcedure.mutation(async ({ ctx }) => {
    const useCase = container.getClearCartUseCase();
    return useCase.execute(ctx.user.id);
  }),
});
