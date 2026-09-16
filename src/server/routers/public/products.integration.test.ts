/**
 * Storefront product router — equivalence integration tests.
 *
 * The router stopped fetching images and variants one product at a time and
 * started batching them. That is only a safe change if the batched path
 * produces the *same payload* — a card that loses its image or its variant
 * options is a broken card, however fast it arrives.
 *
 * Existing catalogue tests compare the batched shape with a repository oracle;
 * the availability test below creates and removes its own isolated fixture.
 *
 * The shared catalogue assertions are read-only; the isolated state fixture
 * cleans up every row it creates.
 */

import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { container } from "@/application/container";
import { createAnonymousCaller } from "@/server/caller";
import { client, db } from "@/db";
import {
  inventoryAdjustmentRequests,
  inventoryInspections,
  products,
  productVariants,
} from "@/db/schema";
import { eq } from "drizzle-orm";

// The storefront endpoints are all `publicProcedure`, so an anonymous context
// is the real thing rather than a stub. This is the same caller the server
// components use, so these tests exercise the server-rendering path too.
const caller = createAnonymousCaller();

const productRepo = container.getProductRepository();
const imageRepo = container.getProductImageRepository();
const variantRepo = container.getProductVariantRepository();

/** The repository sellability read, kept as the payload oracle. */
async function cardDataOracle(productId: string) {
  const [images, sellableVariants] = await Promise.all([
    imageRepo.findByProduct(productId),
    variantRepo.findSellableByProduct(productId),
  ]);
  const primary = images.find((img) => img.isPrimary) || images[0];
  return {
    primaryImage: primary?.imageUrl ?? null,
    variants: sellableVariants
      .filter(({ variant }) => variant.isAvailable)
      .map((v) => ({
        id: v.variant.id,
        size: v.variant.size,
        color: v.variant.color,
        inStock: v.sellableStock > 0,
      })),
  };
}

beforeAll(async () => {
  const total = await productRepo.count({ isActive: true });
  console.log(`[router] ${total} active products available to page through`);
});

afterAll(async () => {
  await client.end({ timeout: 5 });
});

describe("products.list", () => {
  it("returns a coherent page envelope", async () => {
    const res = await caller.public.products.list({ limit: 12, cursor: 1 });

    console.log(
      `[router] list p1: ${res.products.length} products, total=${res.total}, totalPages=${res.totalPages}`
    );

    expect(res.page).toBe(1);
    expect(res.limit).toBe(12);
    expect(res.products.length).toBeLessThanOrEqual(12);
    expect(res.totalPages).toBe(Math.ceil(res.total / res.limit));
  });

  it("produces the same card data the per-product fetching did", async () => {
    // The core equivalence check for the batching change.
    const res = await caller.public.products.list({ limit: 12, cursor: 1 });

    for (const product of res.products) {
      const expected = await cardDataOracle(product.id);
      expect(product.primaryImage).toBe(expected.primaryImage);
      expect(product.variants).toEqual(expected.variants);
    }
  });

  it("pages without overlap", async () => {
    const [p1, p2] = await Promise.all([
      caller.public.products.list({ limit: 5, cursor: 1 }),
      caller.public.products.list({ limit: 5, cursor: 2 }),
    ]);

    const ids1 = p1.products.map((p) => p.id);
    const ids2 = p2.products.map((p) => p.id);
    expect(ids1.filter((id) => ids2.includes(id))).toEqual([]);
  });

  it("reports a total that matches what paging actually yields", async () => {
    const first = await caller.public.products.list({ limit: 10, cursor: 1 });
    const seen = new Set<string>();

    for (let page = 1; page <= first.totalPages; page++) {
      const res = await caller.public.products.list({
        limit: 10,
        cursor: page,
      });
      res.products.forEach((p) => seen.add(p.id));
    }

    expect(seen.size).toBe(first.total);
  });

  it("only ever returns active products", async () => {
    const res = await caller.public.products.list({ limit: 50, cursor: 1 });
    for (const product of res.products) {
      const full = await productRepo.findById(product.id);
      expect(full?.isActive).toBe(true);
    }
  });

  it("applies the on-sale filter", async () => {
    const res = await caller.public.products.list({
      limit: 50,
      cursor: 1,
      isOnSale: true,
    });
    console.log(`[router] isOnSale total=${res.total}`);
    for (const product of res.products) {
      expect(product.salePrice).not.toBeNull();
      expect(product.salePrice!).toBeLessThan(product.basePrice);
    }
  });
});

describe("products.search", () => {
  it("returns only products matching the term", async () => {
    const seed = await caller.public.products.list({ limit: 1, cursor: 1 });
    const sample = seed.products[0];
    if (!sample) return;

    const term = sample.name.split(" ")[0];
    const res = await caller.public.products.search({
      query: term,
      limit: 12,
      cursor: 1,
    });

    console.log(`[router] search("${term}") total=${res.total}`);
    expect(res.total).toBeGreaterThan(0);

    const needle = term.toLowerCase();
    for (const product of res.products) {
      const matches =
        product.name.toLowerCase().includes(needle) ||
        (product.description ?? "").toLowerCase().includes(needle);
      expect(matches).toBe(true);
    }
  });

  it("carries the same card data as the list endpoint", async () => {
    const res = await caller.public.products.search({
      query: "a",
      limit: 6,
      cursor: 1,
    });
    for (const product of res.products) {
      const expected = await cardDataOracle(product.id);
      expect(product.primaryImage).toBe(expected.primaryImage);
      expect(product.variants).toEqual(expected.variants);
    }
  });

  it("does not match everything when the term is a wildcard character", async () => {
    const all = await caller.public.products.list({ limit: 1, cursor: 1 });
    const wildcard = await caller.public.products.search({
      query: "%",
      limit: 1,
      cursor: 1,
    });

    console.log(
      `[router] search("%") total=${wildcard.total} vs all active=${all.total}`
    );
    expect(wildcard.total).toBeLessThan(all.total);
  });
});

describe("categories.list", () => {
  it("counts products per category the way a per-category scan would", async () => {
    const categories = await caller.public.categories.list();
    console.log(`[router] ${categories.length} active categories`);

    for (const category of categories) {
      // The full scan the router used to run, per category.
      const expected = await productRepo.count({
        isActive: true,
        categoryId: category.id,
      });
      expect(category.productCount).toBe(expected);
    }
  });
});

describe("getStock", () => {
  it("publishes protected, green, extra, flaw, manual, and zero states", async () => {
    const token = randomUUID();
    const productId = randomUUID();
    const variantId = randomUUID();
    const inspectionId = randomUUID();
    const productName = "Public stock test " + token;
    const variantSku = "PUBLIC-STOCK-VARIANT-" + token;

    await db.insert(products).values({
      id: productId,
      name: productName,
      slug: "public-stock-" + token,
      sku: "PUBLIC-STOCK-PRODUCT-" + token,
      basePrice: "100",
    });
    await db.insert(productVariants).values({
      id: variantId,
      productId,
      sku: variantSku,
      size: "M",
      color: "Black",
      stockQuantity: 11,
      isAvailable: true,
    });

    const read = () =>
      caller.public.products.getStock({ variantIds: [variantId] });

    try {
      await db.insert(inventoryInspections).values({
        id: inspectionId,
        variantId,
        productName,
        sku: variantSku,
        size: "M",
        color: "Black",
        triggerStock: 11,
      });
      await expect(read()).resolves.toMatchObject({
        stock: { [variantId]: 1 },
        states: { [variantId]: "inspection_pending" },
      });

      await db
        .update(inventoryInspections)
        .set({ status: "all_fine" })
        .where(eq(inventoryInspections.id, inspectionId));
      await expect(read()).resolves.toMatchObject({
        stock: { [variantId]: 11 },
        states: { [variantId]: "available" },
      });

      await db.insert(inventoryAdjustmentRequests).values({
        variantId,
        productName,
        sku: variantSku,
        size: "M",
        color: "Black",
        category: "extra",
        requestedQuantity: 2,
        explanation: "Extra units found",
        stockAtRequest: 11,
        requesterName: "Test Worker",
      });
      await expect(read()).resolves.toMatchObject({
        stock: { [variantId]: 11 },
        states: { [variantId]: "available" },
      });

      await db.insert(inventoryAdjustmentRequests).values({
        variantId,
        productName,
        sku: variantSku,
        size: "M",
        color: "Black",
        category: "missing",
        requestedQuantity: 1,
        explanation: "Units missing",
        stockAtRequest: 11,
        requesterName: "Test Worker",
      });
      await expect(read()).resolves.toMatchObject({
        stock: { [variantId]: 0 },
        states: { [variantId]: "quarantined" },
      });

      await db
        .delete(inventoryAdjustmentRequests)
        .where(eq(inventoryAdjustmentRequests.variantId, variantId));
      await db
        .update(productVariants)
        .set({ isAvailable: false })
        .where(eq(productVariants.id, variantId));
      await expect(read()).resolves.toMatchObject({
        stock: { [variantId]: 0 },
        states: { [variantId]: "manually_unavailable" },
      });

      await db
        .update(productVariants)
        .set({ isAvailable: true, stockQuantity: 0 })
        .where(eq(productVariants.id, variantId));
      await expect(read()).resolves.toMatchObject({
        stock: { [variantId]: 0 },
        states: { [variantId]: "out_of_stock" },
      });
    } finally {
      await db
        .delete(inventoryAdjustmentRequests)
        .where(eq(inventoryAdjustmentRequests.variantId, variantId));
      await db
        .delete(inventoryInspections)
        .where(eq(inventoryInspections.variantId, variantId));
      await db.delete(productVariants).where(eq(productVariants.id, variantId));
      await db.delete(products).where(eq(products.id, productId));
    }
  });

  it("answers for a whole grid's worth of variants in one call", async () => {
    // The shared provider sends every card's variants at once; the endpoint has
    // to accept that many.
    const page = await caller.public.products.list({ limit: 12, cursor: 1 });
    const variantIds = page.products.flatMap((p) =>
      p.variants.map((v) => v.id)
    );

    if (variantIds.length === 0) return;

    const res = await caller.public.products.getStock({ variantIds });
    console.log(
      `[router] getStock asked for ${variantIds.length} variants, got ${Object.keys(res.stock).length}`
    );

    for (const id of variantIds) {
      expect(res.stock[id]).toBeTypeOf("number");
      expect(res.stock[id]).toBeGreaterThanOrEqual(0);
      expect(res.states[id]).toBeTypeOf("string");
    }
  });

  it("returns an empty map for an empty request", async () => {
    const res = await caller.public.products.getStock({ variantIds: [] });
    expect(res.stock).toEqual({});
    expect(res.states).toEqual({});
  });
});
