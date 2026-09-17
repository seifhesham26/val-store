import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { client } from "@/db";
import { ProductEntity } from "@/domain/products/entities/product.entity";
import { AddProductVariantUseCase } from "@/application/products/use-cases/add-product-variant.use-case";
import { DrizzleProductRepository } from "./product.repository";
import { DrizzleProductVariantRepository } from "./product-variant.repository";

const products = new DrizzleProductRepository();
const variants = new DrizzleProductVariantRepository();
const createdProductIds: string[] = [];

function productEntity() {
  return new ProductEntity(
    randomUUID(),
    `Opening stock product ${randomUUID()}`,
    `opening-stock-${randomUUID()}`,
    `OPEN-${randomUUID()}`,
    "Opening stock integration fixture",
    100,
    null,
    null,
    0,
    [],
    true,
    false,
    new Date(),
    new Date(),
    "unisex",
    null,
    null,
    null,
    null
  );
}

async function inspectionRows(variantId: string) {
  return client<{ status: string; triggerStock: number }[]>`
    select status, trigger_stock as "triggerStock"
    from inventory_inspections
    where variant_id = ${variantId}
    order by created_at, id
  `;
}

async function inventoryLogCount(variantId: string) {
  const [row] = await client<{ count: number }[]>`
    select count(*)::int as count
    from inventory_logs where variant_id = ${variantId}
  `;
  return row.count;
}

afterEach(async () => {
  for (const productId of createdProductIds.splice(0)) {
    await client`delete from inventory_inspections
      where variant_id in (select id from product_variants where product_id = ${productId})`;
    await client`delete from product_variants where product_id = ${productId}`;
    await client`delete from products where id = ${productId}`;
  }
});

afterAll(async () => {
  await client.end({ timeout: 5 });
});

describe("opening stock inspection reconciliation", () => {
  it.each([
    [0, 0],
    [1, 1],
    [20, 1],
    [21, 0],
  ])(
    "single variant opening stock %i creates %i inspections",
    async (stock, expected) => {
      const product = await products.create(productEntity());
      createdProductIds.push(product.id);
      const useCase = new AddProductVariantUseCase(variants, products);

      const created = await useCase.execute({
        productId: product.id,
        sku: `OPEN-VARIANT-${randomUUID()}`,
        stockQuantity: stock,
      });

      expect(await inspectionRows(created.id)).toEqual(
        expected === 0 ? [] : [{ status: "pending", triggerStock: stock }]
      );
      expect(await inventoryLogCount(created.id)).toBe(0);
    }
  );

  it("reconciles every batched opening stock in the product transaction", async () => {
    const product = await products.create(productEntity(), {
      variants: [0, 1, 20, 21].map((stock) => ({
        sku: `OPEN-BATCH-${stock}-${randomUUID()}`,
        stockQuantity: stock,
        priceAdjustment: 0,
      })),
    });
    createdProductIds.push(product.id);

    const rows = await client<{ id: string; stockQuantity: number }[]>`
      select id, stock_quantity as "stockQuantity"
      from product_variants where product_id = ${product.id}
      order by stock_quantity, id
    `;
    expect(
      await Promise.all(
        rows.map(async (row) => [
          row.stockQuantity,
          await inspectionRows(row.id),
          await inventoryLogCount(row.id),
        ])
      )
    ).toEqual([
      [0, [], 0],
      [1, [{ status: "pending", triggerStock: 1 }], 0],
      [20, [{ status: "pending", triggerStock: 20 }], 0],
      [21, [], 0],
    ]);
  });
});
