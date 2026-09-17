import "dotenv/config";
import { db, client } from "../src/db";
import { productVariants } from "../src/db/schema";
import {
  assertDevelopmentResetAllowed,
  getDevelopmentResetMode,
} from "../src/lib/development-inventory-reset";

async function main() {
  assertDevelopmentResetAllowed(process.env.NODE_ENV);
  const mode = getDevelopmentResetMode(process.argv.slice(2));
  const variants = await db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      stockQuantity: productVariants.stockQuantity,
    })
    .from(productVariants)
    .orderBy(productVariants.sku);

  console.log(
    `Development inventory reset (${mode === "apply" ? "APPLY" : "DRY RUN"})`
  );
  if (variants.length === 0) {
    console.log("No variants found.");
    return;
  }
  for (const variant of variants) {
    console.log(
      `  ${variant.id}  ${variant.sku}  ${variant.stockQuantity} -> 0`
    );
  }

  if (mode === "dry-run") {
    console.log("No changes written. Re-run with --apply to reset stock.");
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(productVariants)
      .set({ stockQuantity: 0, updatedAt: new Date() });
  });
  console.log(
    `Reset ${variants.length} variant${variants.length === 1 ? "" : "s"}; manual availability was not changed.`
  );
}

main()
  .catch((error) => {
    console.error("Development inventory reset failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
