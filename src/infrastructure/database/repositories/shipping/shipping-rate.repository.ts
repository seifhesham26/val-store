/**
 * Drizzle Shipping Rate Repository
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { shippingRates, siteSettings } from "@/db/schema";
import type {
  ShippingConfig,
  ShippingRateRepositoryInterface,
  ShippingRateUpdate,
} from "@/domain/shipping/interfaces/repositories/shipping-rate.repository.interface";

/**
 * Money is stored as a Postgres `decimal`, which postgres.js hands back as a
 * string. Parsing at the repository boundary is the codebase's convention —
 * a `sql<number>` assertion would compile and still be a string at runtime.
 */
function toNumber(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export class DrizzleShippingRateRepository implements ShippingRateRepositoryInterface {
  async getConfig(): Promise<ShippingConfig> {
    // Issued together so postgres.js pipelines them down one connection: two
    // queries, about one round trip. Awaiting in sequence would pay for two.
    const [rows, settings] = await Promise.all([
      db.select().from(shippingRates),
      db.select().from(siteSettings).limit(1),
    ]);

    return {
      rates: rows.map((row) => ({
        governorate: row.governorate,
        fee: toNumber(row.fee),
        isDeliverable: row.isDeliverable,
      })),
      freeShippingThreshold: toNumber(settings[0]?.freeShippingThreshold),
    };
  }

  async upsertRates(
    rates: ShippingRateUpdate[],
    userId: string
  ): Promise<void> {
    if (rates.length === 0) return;

    // One transaction: a partly-applied rate change would leave the store
    // charging a mix of old and new prices, which is worse than either.
    await db.transaction(async (tx) => {
      for (const rate of rates) {
        await tx
          .insert(shippingRates)
          .values({
            governorate: rate.governorate,
            // Stored as a decimal string, matching how every other money
            // column in this schema is written.
            fee: String(Math.max(0, rate.fee)),
            isDeliverable: rate.isDeliverable,
            updatedBy: userId,
          })
          .onConflictDoUpdate({
            target: shippingRates.governorate,
            set: {
              fee: String(Math.max(0, rate.fee)),
              isDeliverable: rate.isDeliverable,
              updatedAt: new Date(),
              updatedBy: userId,
            },
          });
      }
    });
  }

  async setFreeShippingThreshold(value: number, userId: string): Promise<void> {
    const existing = await db.select().from(siteSettings).limit(1);
    if (!existing[0]) {
      throw new Error("Site settings row does not exist");
    }

    await db
      .update(siteSettings)
      .set({
        freeShippingThreshold: String(Math.max(0, value)),
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(siteSettings.id, existing[0].id));
  }
}
