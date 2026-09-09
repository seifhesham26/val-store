/**
 * Shipping Rates Admin Router
 *
 * Delivery fees per governorate and the store-wide free-shipping threshold.
 * Rates were environment variables until this existed, which meant a courier
 * price change needed a deploy.
 */

import { z } from "zod";
import { router, adminProcedure, adminWriteProcedure } from "../../trpc";
import { container } from "@/application/container";
import { EGYPT_GOVERNORATES } from "@/domain/shipping/egypt-governorates";

const GOVERNORATE_CODES = EGYPT_GOVERNORATES.map((g) => g.code) as [
  string,
  ...string[],
];

const rateSchema = z.object({
  // Constrained to the known set: an arbitrary key would create a row nothing
  // can ever match, silently doing nothing.
  governorate: z.enum(GOVERNORATE_CODES),
  fee: z.number().min(0).max(100000),
  isDeliverable: z.boolean(),
});

export const shippingRouter = router({
  /** Current rates and threshold. */
  getConfig: adminProcedure.query(async () => {
    const repo = container.getShippingRateRepository();
    return repo.getConfig();
  }),

  /**
   * Save a batch of rates. The admin screen sends every governorate it changed,
   * so a zone-wide edit is one mutation rather than one per governorate.
   */
  updateRates: adminWriteProcedure
    .input(z.object({ rates: z.array(rateSchema).min(1).max(27) }))
    .mutation(async ({ input, ctx }) => {
      const repo = container.getShippingRateRepository();
      await repo.upsertRates(input.rates, ctx.user.id);
      return { updated: input.rates.length };
    }),

  setFreeShippingThreshold: adminWriteProcedure
    .input(z.object({ value: z.number().min(0).max(1000000) }))
    .mutation(async ({ input, ctx }) => {
      const repo = container.getShippingRateRepository();
      await repo.setFreeShippingThreshold(input.value, ctx.user.id);
      return { success: true };
    }),
});
