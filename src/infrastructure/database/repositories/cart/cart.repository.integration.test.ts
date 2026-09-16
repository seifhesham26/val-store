import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, client } from "@/db";
import {
  cartItems,
  carts,
  inventoryAdjustmentRequests,
  inventoryInspections,
  products,
  productVariants,
  user,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { CartItemEntity } from "@/domain/cart/entities/cart-item.entity";
import { UpdateCartItemUseCase } from "@/application/cart/use-cases/update-cart-item.use-case";
import { DrizzleCartRepository } from "./cart.repository";

const suffix = randomUUID();
const userId = "cart-stock-" + suffix;
const productId = randomUUID();
const variantId = randomUUID();
const repo = new DrizzleCartRepository();

function line(quantity: number): CartItemEntity {
  return new CartItemEntity(
    "",
    userId,
    productId,
    "",
    0,
    null,
    quantity,
    0,
    new Date(),
    new Date(),
    variantId
  );
}

beforeAll(async () => {
  await db.insert(user).values({
    id: userId,
    name: "Cart Stock Integration",
    email: "cart-stock-" + suffix + "@example.com",
  });
  await db.insert(products).values({
    id: productId,
    name: "Cart Stock Fixture",
    slug: "cart-stock-" + suffix,
    sku: "CART-" + suffix,
    basePrice: "100.00",
  });
  await db.insert(productVariants).values({
    id: variantId,
    productId,
    sku: "CART-V-" + suffix,
    stockQuantity: 11,
  });
});

afterAll(async () => {
  await db
    .delete(inventoryAdjustmentRequests)
    .where(eq(inventoryAdjustmentRequests.variantId, variantId));
  await db
    .delete(inventoryInspections)
    .where(eq(inventoryInspections.variantId, variantId));
  await db.delete(carts).where(eq(carts.userId, userId));
  await db.delete(productVariants).where(eq(productVariants.id, variantId));
  await db.delete(products).where(eq(products.id, productId));
  await db.delete(user).where(eq(user.id, userId));
  await client.end({ timeout: 5 });
});

describe("DrizzleCartRepository sellable stock ceiling", () => {
  it("protects inspected and disputed stock across cart reads and writes", async () => {
    const [inspection] = await db
      .insert(inventoryInspections)
      .values({
        variantId,
        productName: "Cart Stock Fixture",
        sku: "CART-V-" + suffix,
        triggerStock: 11,
      })
      .returning();

    const added = await repo.addItem(line(1));
    expect(added.quantity).toBe(1);
    expect(added.maxStock).toBe(1);
    await expect(repo.addItem(line(1))).rejects.toThrow("Only 1 left in stock");

    await db
      .update(cartItems)
      .set({ quantity: 3 })
      .where(eq(cartItems.id, added.id));
    const reduced = await new UpdateCartItemUseCase(repo).execute({
      cartItemId: added.id,
      quantity: 1,
      userId,
    });
    expect(reduced.cartItem.quantity).toBe(1);

    await db.delete(cartItems).where(eq(cartItems.id, added.id));
    await db
      .delete(inventoryInspections)
      .where(eq(inventoryInspections.id, inspection.id));

    const [flaw] = await db
      .insert(inventoryAdjustmentRequests)
      .values({
        variantId,
        requesterId: userId,
        productName: "Cart Stock Fixture",
        sku: "CART-V-" + suffix,
        category: "missing",
        requestedQuantity: 1,
        explanation: "Integration fixture",
        stockAtRequest: 11,
        requesterName: "Cart Stock Integration",
      })
      .returning();
    await expect(repo.addItem(line(1))).rejects.toThrow("out of stock");
    await db
      .delete(inventoryAdjustmentRequests)
      .where(eq(inventoryAdjustmentRequests.id, flaw.id));

    await db.insert(inventoryAdjustmentRequests).values({
      variantId,
      requesterId: userId,
      productName: "Cart Stock Fixture",
      sku: "CART-V-" + suffix,
      category: "extra",
      requestedQuantity: 1,
      explanation: "Integration fixture",
      stockAtRequest: 11,
      requesterName: "Cart Stock Integration",
    });
    await expect(repo.addItem(line(11))).resolves.toMatchObject({
      quantity: 11,
      maxStock: 11,
    });
  });
});
