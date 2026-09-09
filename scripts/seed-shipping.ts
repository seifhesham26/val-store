/**
 * Shipping Rates Seed
 *
 * Ensures every Egyptian governorate has a row so the admin screen always has
 * 27 editable lines, even for a governorate added to the list later.
 *
 * Run with: pnpm seed:shipping
 */

import "dotenv/config";
import { db } from "../src/db";
import { shippingRates } from "../src/db/schema";
import { EGYPT_GOVERNORATES } from "../src/domain/shipping/egypt-governorates";

/**
 * Inserts missing governorates and leaves existing rows completely alone.
 *
 * `onConflictDoNothing`, not `onConflictDoUpdate`, and that is the whole point:
 * these rows are operator-owned data, not canonical content. A seed that
 * upserted would silently reset every price the store had configured the next
 * time anyone ran `pnpm seed` — the opposite of what a seed is for here, and
 * the kind of loss you only notice from a customer's invoice.
 *
 * New rows start at zero and deliverable, so seeding never begins charging
 * anyone; charging starts when someone types a number into the admin.
 */
export async function seedShippingRates(): Promise<number> {
  const rows = EGYPT_GOVERNORATES.map((g) => ({
    governorate: g.code,
    fee: "0",
    isDeliverable: true,
  }));

  await db.insert(shippingRates).values(rows).onConflictDoNothing({
    target: shippingRates.governorate,
  });

  return rows.length;
}

async function main() {
  try {
    const count = await seedShippingRates();
    console.log(`\n✨ Shipping seed completed successfully!\n`);
    console.log("📋 Summary:");
    console.log(
      `  - ${count} governorates ensured (existing rates untouched)\n`
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Shipping seed failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
