/**
 * Storefront shipping quotes.
 *
 * `quote` is a genuine `publicProcedure` and must stay one: it never calls
 * `ctx.getUser()`, so `touchedAuth()` stays false and the response remains
 * cacheable. Delivery pricing depends on the destination and the order value,
 * not on who is asking.
 *
 * It shares `quoteShipping` with `CreateOrderUseCase`, so the figure a customer
 * is shown at checkout is produced by the same function that charges them.
 * Two implementations would eventually disagree, and the customer would be the
 * one to notice.
 */

import { z } from "zod";
import { router, publicProcedure } from "../../trpc";
import { container } from "@/application/container";
import { quoteShipping } from "@/domain/shipping/shipping-rate";

export const publicShippingRouter = router({
  quote: publicProcedure
    .input(
      z.object({
        governorate: z.string().max(100).nullable(),
        subtotal: z.number().min(0),
      })
    )
    .query(async ({ input }) => {
      const repo = container.getShippingRateRepository();
      const config = await repo.getConfig();

      return quoteShipping({
        subtotal: input.subtotal,
        governorate: input.governorate,
        rates: config.rates,
        freeShippingThreshold: config.freeShippingThreshold,
      });
    }),
});
