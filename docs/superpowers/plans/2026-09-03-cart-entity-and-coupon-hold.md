# Cart Entity and Coupon Hold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the cart from an implicit `WHERE user_id =` collection into a real `carts` entity, and hold one applied coupon on it that silently re-validates every 15 minutes.

**Architecture:** A new `carts` table owns `cart_items` via `cart_id` and carries three nullable coupon columns. `CartRepositoryInterface` keeps every existing `userId`-keyed signature and resolves `userId → cart_id` internally, so use cases, routers and the cart provider are untouched. Re-validation is lazy — it happens on a cart read when the last check is older than 15 minutes. There is no cron, queue or worker.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, PostgreSQL via Drizzle over postgres.js, tRPC v11, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-03-cart-entity-and-coupon-hold-design.md`

## Global Constraints

- **Branch:** work continues on `fix/audit-findings`, which already carries 26 uncommitted audit fixes. Do not rebase, reset, or revert that work.
- **Money never lives in the cart.** The cart stores _which_ coupon is applied and returns its code. It never computes or returns a discount amount or a discounted total. Checkout is the only place money is calculated.
- **Signed-in only.** Every coupon procedure is `protectedProcedure`. No guest coupon path, no coupon logic in the guest-cart merge.
- **A hold reserves nothing.** Applying a coupon must not decrement, lock, or otherwise consume a redemption. The guarded conditional `UPDATE` in `order.repository.ts` remains the sole authority on redemption limits and must not be modified by this plan.
- **No visible countdown** in any UI. The 15 minutes is internal.
- **The three coupon columns move together** — `coupon_id`, `coupon_applied_at`, `coupon_checked_at` are all set or all null. No other combination is valid.
- **Prettier:** double quotes, semicolons, 80 columns, es5 trailing commas, LF.
- **Clear `.next` before trusting type-check:** `rm -rf .next && pnpm type-check`.
- **Commit style:** conventional commits, restricted type-enum, **sentence-case subject**, no trailing period, ≤100 chars. Husky runs commitlint and lint-staged.
- **Integration tests are read-only by project rule.** Do not write integration tests that write to the database.

## File Structure

| File                                                                   | Responsibility                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/db/schema.ts`                                                     | Add `carts`; re-point `cart_items` at `cart_id`        |
| `src/db/relations.ts`                                                  | `cartItems → carts`, `carts → user`, `carts → coupons` |
| `src/infrastructure/database/repositories/cart/cart.repository.ts`     | Resolve `userId → cart_id`; coupon column reads/writes |
| `src/domain/cart/interfaces/repositories/cart.repository.interface.ts` | Four new coupon methods                                |
| `src/lib/cart-coupon-freshness.ts`                                     | **New.** Pure staleness decision, unit-tested          |
| `src/application/cart/use-cases/apply-coupon.use-case.ts`              | **New.** Validate and store                            |
| `src/application/cart/use-cases/remove-coupon.use-case.ts`             | **New.** Clear                                         |
| `src/application/cart/use-cases/get-cart.use-case.ts`                  | Lazy re-validation, `appliedCoupon` output             |
| `src/application/cart/cart.container.ts`                               | Wire the two new use cases                             |
| `src/server/routers/public/cart.ts`                                    | `applyCoupon`, `removeCoupon`                          |
| `src/server/routers/public/checkout.ts`                                | Drop `couponCode` input; read from cart                |
| `src/app/api/webhook/stripe/route.ts`                                  | Use `clearCart` instead of raw delete                  |
| `src/components/cart/CouponField.tsx`                                  | **New.** Apply/remove UI                               |

---

### Task 1: Schema — the `carts` table

**Files:**

- Modify: `src/db/schema.ts` (`cartItems` at ~line 456)
- Modify: `src/db/relations.ts` (~line 161)

**Interfaces:**

- Consumes: nothing.
- Produces: `carts` table object; `Cart` / `NewCart` types; `cartItems.cartId` column.

There is no unit test for a schema definition — the verification is that the type checker and `db:push` accept it, and that the seed still runs. That is stated rather than faked with an assertion-free test.

- [ ] **Step 1: Add the `carts` table to `src/db/schema.ts`, immediately above `cartItems`**

```ts
export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Unique for now, which preserves exactly the current "one cart per
    // user" behaviour. Dropping this constraint is what would later allow
    // saved or multiple carts; nothing else needs to change for that.
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    // SET NULL, deliberately not cascade: deleting a coupon must not delete
    // the carts that referenced it.
    couponId: uuid("coupon_id").references(() => coupons.id, {
      onDelete: "set null",
    }),
    // These three move together. Either all are set or all are null.
    couponAppliedAt: timestamp("coupon_applied_at"),
    couponCheckedAt: timestamp("coupon_checked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_carts_user_id").on(table.userId),
  })
);
```

- [ ] **Step 2: Re-point `cartItems` at the cart**

Replace the `userId` column and the `idx_cart_user_id` index:

```ts
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "cascade",
    }),
    quantity: integer("quantity").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    cartIdIdx: index("idx_cart_items_cart_id").on(table.cartId),
    productIdIdx: index("idx_cart_product_id").on(table.productId),
  })
);
```

- [ ] **Step 3: Export the types**

Beside the other `$inferSelect` exports:

```ts
export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;
```

- [ ] **Step 4: Update `src/db/relations.ts`**

The `cartItems → user` relation at ~line 161 becomes a relation to `carts`. Add a `cartsRelations` with `user`, `coupon` and `items`.

```ts
export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(user, {
    fields: [carts.userId],
    references: [user.id],
  }),
  coupon: one(coupons, {
    fields: [carts.couponId],
    references: [coupons.id],
  }),
  items: many(cartItems),
}));
```

And in `cartItemsRelations`, replace the `user` relation with:

```ts
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id],
  }),
```

- [ ] **Step 5: Push the schema**

Run: `pnpm db:push`

Drizzle will report that `cart_items.user_id` is being dropped and `cart_id` added as `NOT NULL`. **Accept the data loss.** The store is not live and cart rows are seed fixtures. If prompted to truncate `cart_items`, do so.

- [ ] **Step 6: Confirm the type checker sees every broken call site**

Run: `rm -rf .next && pnpm type-check`
Expected: **FAIL**, with errors at each `cartItems.userId` reference — `cart.repository.ts` (5), `webhook/stripe/route.ts:127`, `checkout.ts:139`, `relations.ts`. This failing list is the work for Tasks 2 and 3. Record it.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts src/db/relations.ts
git commit -m "feat(cart): Add carts table and point cart items at it"
```

---

### Task 2: Repository resolves `userId` to `cart_id`

**Files:**

- Modify: `src/infrastructure/database/repositories/cart/cart.repository.ts`

**Interfaces:**

- Consumes: `carts`, `Cart` from Task 1.
- Produces: private `findCartByUserId(userId): Promise<Cart | null>` and `getOrCreateCart(userId): Promise<Cart>`. **`CartRepositoryInterface` is unchanged in this task** — every public signature stays `userId`-keyed.

The public behaviour must be identical after this task. The evidence is that the existing suite passes untouched.

- [ ] **Step 1: Add the two private resolvers at the top of the class**

```ts
  /**
   * The cart row for a user, or null.
   *
   * Reads use this: a customer who has never added anything has no cart row,
   * and reading their cart must not create one. Only writes create.
   */
  private async findCartByUserId(userId: string): Promise<Cart | null> {
    const [cart] = await db
      .select()
      .from(carts)
      .where(eq(carts.userId, userId))
      .limit(1);
    return cart ?? null;
  }

  /**
   * The cart row for a user, creating it if this is their first write.
   *
   * `onConflictDoNothing` plus a re-read rather than a read-then-insert: two
   * concurrent first adds would both see no row and both try to insert, and
   * `carts.user_id` is unique, so the loser would throw. This lets the loser
   * fall through to the re-read and find the winner's row.
   */
  private async getOrCreateCart(userId: string): Promise<Cart> {
    const existing = await this.findCartByUserId(userId);
    if (existing) return existing;

    await db.insert(carts).values({ userId }).onConflictDoNothing();

    const created = await this.findCartByUserId(userId);
    if (!created) {
      throw new Error("Failed to create cart");
    }
    return created;
  }
```

- [ ] **Step 2: Import `carts` and the `Cart` type**

```ts
import {
  carts,
  cartItems,
  products,
  productVariants,
  productImages,
} from "@/db/schema";
import type { Cart } from "@/db/schema";
```

- [ ] **Step 3: Convert every read**

`findByUserId`, `findByUserAndProduct`, `getCartTotal`, `getCartItemCount`, `isProductInCart` each begin by resolving the cart and returning the empty result when there is none. For example, `findByUserId`:

```ts
  async findByUserId(userId: string): Promise<CartItemEntity[]> {
    const cart = await this.findCartByUserId(userId);
    if (!cart) return [];
    // ...existing query, with `eq(cartItems.userId, userId)` replaced by
    // `eq(cartItems.cartId, cart.id)`
  }
```

Empty results by method: `findByUserId` → `[]`, `findByUserAndProduct` → `null`, `getCartTotal` → `0`, `getCartItemCount` → `0`, `isProductInCart` → `false`.

- [ ] **Step 4: Convert `addItem` to use `getOrCreateCart`**

`addItem` is the only insert. Replace the `.values({ userId: cartItem.userId, ... })` block:

```ts
const cart = await this.getOrCreateCart(cartItem.userId);

const [newItem] = await db
  .insert(cartItems)
  .values({
    cartId: cart.id,
    productId: cartItem.productId,
    variantId: cartItem.variantId,
    quantity: cartItem.quantity,
  })
  .returning();
```

`CartItemEntity` keeps its `userId` field — that is the domain concept and callers still pass it. Only the row shape changes.

- [ ] **Step 5: Convert `clearCart`**

```ts
  async clearCart(userId: string): Promise<void> {
    const cart = await this.findCartByUserId(userId);
    if (!cart) return;
    await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
  }
```

The `carts` row itself is left in place — it is the customer's cart, not its contents.

- [ ] **Step 6: Confirm the guest merge needs no change**

`MergeGuestCartItemsUseCase` calls `cartRepository.addItem` and
`updateQuantity`, both of which now resolve the cart themselves. Read it and
confirm it contains no direct `cartItems` reference. Expect **no edit**; if it
does reference the table, it moves behind the repository like the payment-path
deletes in Task 3.

- [ ] **Step 7: Verify nothing behavioural changed**

Run: `pnpm test`
Expected: PASS, same count as before this task (393 at the time of writing). No test file is edited in this task. If a cart test fails, the refactor changed behaviour and must be corrected, not the test.

- [ ] **Step 8: Commit**

```bash
git add src/infrastructure/database/repositories/cart/cart.repository.ts
git commit -m "refactor(cart): Resolve cart id inside the repository"
```

---

### Task 3: Move the payment-path deletes behind the repository

**Files:**

- Modify: `src/app/api/webhook/stripe/route.ts:127`
- Modify: `src/server/routers/public/checkout.ts:139`

**Interfaces:**

- Consumes: `clearCart(userId)` from Task 2.
- Produces: nothing new.

Both sites currently reach past the repository into `cartItems` from the payment path. Task 1 broke them; this fixes them properly rather than translating the raw SQL.

- [ ] **Step 1: Replace the webhook's raw delete**

Was `db.delete(cartItems).where(eq(cartItems.userId, metadata.userId))`:

```ts
await container.getCartRepository().clearCart(metadata.userId);
```

Remove the now-unused `cartItems` and `eq` imports if nothing else in the file uses them. Keep the surrounding try/catch — clearing the cart must never fail a recognised payment.

- [ ] **Step 2: Replace the same delete in `checkout.ts` `confirmSession`**

```ts
await container.getCartRepository().clearCart(ctx.user.id);
```

- [ ] **Step 3: Verify the tree is whole again**

Run: `rm -rf .next && pnpm type-check`
Expected: **PASS.** Every error recorded in Task 1 Step 6 is now resolved.

- [ ] **Step 4: Run lint and the suite**

Run: `pnpm lint && pnpm test`
Expected: lint 0 problems; tests pass at the same count as Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhook/stripe/route.ts src/server/routers/public/checkout.ts
git commit -m "refactor(cart): Clear the cart through the repository on payment"
```

---

### Task 4: The freshness decision, as a pure module

**Files:**

- Create: `src/lib/cart-coupon-freshness.ts`
- Test: `src/lib/cart-coupon-freshness.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `COUPON_RECHECK_MS: number`, `needsRecheck(checkedAt: Date | null, now: number): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { COUPON_RECHECK_MS, needsRecheck } from "./cart-coupon-freshness";

const NOW = new Date("2026-09-03T12:00:00.000Z").getTime();

describe("needsRecheck", () => {
  it("rechecks a coupon that has never been checked", () => {
    // A coupon is validated when applied, so this should not happen — but a
    // null here means we cannot show it is fresh, and the safe answer to
    // "is this stale?" is yes.
    expect(needsRecheck(null, NOW)).toBe(true);
  });

  it("leaves a coupon checked a moment ago alone", () => {
    expect(needsRecheck(new Date(NOW - 1000), NOW)).toBe(false);
  });

  it("leaves a coupon checked just inside the window alone", () => {
    expect(needsRecheck(new Date(NOW - (COUPON_RECHECK_MS - 1)), NOW)).toBe(
      false
    );
  });

  it("rechecks exactly on the boundary", () => {
    expect(needsRecheck(new Date(NOW - COUPON_RECHECK_MS), NOW)).toBe(true);
  });

  it("rechecks a coupon checked long ago", () => {
    expect(needsRecheck(new Date(NOW - COUPON_RECHECK_MS * 100), NOW)).toBe(
      true
    );
  });

  it("does not recheck a timestamp from the future", () => {
    // Clock skew between the app and the database should not cause a storm
    // of re-validation.
    expect(needsRecheck(new Date(NOW + 60_000), NOW)).toBe(false);
  });

  it("is fifteen minutes", () => {
    expect(COUPON_RECHECK_MS).toBe(15 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/lib/cart-coupon-freshness.test.ts`
Expected: FAIL — cannot resolve `./cart-coupon-freshness`.

- [ ] **Step 3: Write the module**

```ts
/**
 * When an applied coupon is due a re-check.
 *
 * A coupon on a cart reserves nothing — it is remembered, not held — so this
 * interval is a freshness check rather than a deadline. A coupon that is still
 * valid renews and the customer keeps it; one that has since expired, been
 * deactivated, or hit its limit is dropped with a reason. Nothing about it is
 * shown to the customer as a countdown, because there is nothing to race.
 *
 * Kept free of React and of the database so the decision can be tested on its
 * own, the same reason `cart-sync-registry.ts` sits out here.
 */

/** How long a validation result is trusted before it is checked again. */
export const COUPON_RECHECK_MS = 15 * 60 * 1000;

/**
 * @param checkedAt when the coupon was last successfully validated, or null
 * @param now       current time in epoch milliseconds
 */
export function needsRecheck(checkedAt: Date | null, now: number): boolean {
  if (!checkedAt) return true;

  const age = now - checkedAt.getTime();

  // A future timestamp means clock skew, not staleness. Treating it as stale
  // would re-validate on every read until the clocks agreed.
  if (age < 0) return false;

  return age >= COUPON_RECHECK_MS;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run src/lib/cart-coupon-freshness.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cart-coupon-freshness.ts src/lib/cart-coupon-freshness.test.ts
git commit -m "feat(cart): Add coupon freshness window"
```

---

### Task 5: Repository coupon methods

**Files:**

- Modify: `src/domain/cart/interfaces/repositories/cart.repository.interface.ts`
- Modify: `src/infrastructure/database/repositories/cart/cart.repository.ts`

**Interfaces:**

- Consumes: `getOrCreateCart`, `findCartByUserId` from Task 2.
- Produces, on `CartRepositoryInterface`:
  - `getAppliedCoupon(userId: string): Promise<AppliedCoupon | null>`
  - `setAppliedCoupon(userId: string, couponId: string): Promise<void>`
  - `clearAppliedCoupon(userId: string): Promise<void>`
  - `touchCouponCheckedAt(userId: string): Promise<void>`
  - `export interface AppliedCoupon { couponId: string; code: string; appliedAt: Date; checkedAt: Date }`
    The `code` is carried here, not fetched separately later: `GetCartUseCase`
    (Task 7) needs it to re-validate and to return `appliedCoupon.code`, and a
    second lookup method for one string would be a round trip for nothing.

- [ ] **Step 1: Add the interface methods**

```ts
/** The coupon a cart is currently holding. */
export interface AppliedCoupon {
  couponId: string;
  /** The human-readable code, joined from `coupons` — what the UI renders. */
  code: string;
  appliedAt: Date;
  checkedAt: Date;
}
```

and on `CartRepositoryInterface`:

```ts
  /**
   * The coupon currently applied to this user's cart, or null.
   *
   * Returns the coupon *id*, not a discount. The cart records which code is
   * applied; what it is worth is computed once, at checkout.
   */
  getAppliedCoupon(userId: string): Promise<AppliedCoupon | null>;

  /** Apply a coupon, replacing any already applied. Sets all three columns. */
  setAppliedCoupon(userId: string, couponId: string): Promise<void>;

  /** Remove the applied coupon. Nulls all three columns. */
  clearAppliedCoupon(userId: string): Promise<void>;

  /** Record that the applied coupon was just re-validated successfully. */
  touchCouponCheckedAt(userId: string): Promise<void>;
```

- [ ] **Step 2: Implement them**

Add `coupons` to the `@/db/schema` import at the top of the file.

```ts
  async getAppliedCoupon(userId: string): Promise<AppliedCoupon | null> {
    const cart = await this.findCartByUserId(userId);

    // The three columns move together, so any null means no coupon. Checked
    // explicitly rather than trusting `couponId` alone: a partially written
    // row is a bug, and reading it as "applied" would hide that.
    if (!cart?.couponId || !cart.couponAppliedAt || !cart.couponCheckedAt) {
      return null;
    }

    // Joined rather than exposed as a second method: the caller always wants
    // the code, and `coupon_id` alone would force a round trip per read.
    const [coupon] = await db
      .select({ code: coupons.code })
      .from(coupons)
      .where(eq(coupons.id, cart.couponId))
      .limit(1);

    // The coupon was deleted out from under the cart. `ON DELETE SET NULL`
    // should prevent this, so treat it as no coupon rather than guessing.
    if (!coupon) return null;

    return {
      couponId: cart.couponId,
      code: coupon.code,
      appliedAt: cart.couponAppliedAt,
      checkedAt: cart.couponCheckedAt,
    };
  }

  async setAppliedCoupon(userId: string, couponId: string): Promise<void> {
    const cart = await this.getOrCreateCart(userId);
    const now = new Date();

    await db
      .update(carts)
      .set({
        couponId,
        couponAppliedAt: now,
        couponCheckedAt: now,
        updatedAt: now,
      })
      .where(eq(carts.id, cart.id));
  }

  async clearAppliedCoupon(userId: string): Promise<void> {
    const cart = await this.findCartByUserId(userId);
    if (!cart) return;

    await db
      .update(carts)
      .set({
        couponId: null,
        couponAppliedAt: null,
        couponCheckedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(carts.id, cart.id));
  }

  async touchCouponCheckedAt(userId: string): Promise<void> {
    const cart = await this.findCartByUserId(userId);
    if (!cart) return;

    const now = new Date();
    await db
      .update(carts)
      .set({ couponCheckedAt: now, updatedAt: now })
      .where(eq(carts.id, cart.id));
  }
```

- [ ] **Step 3: Extend `clearCart` to drop the coupon too**

An emptied cart must not keep a coupon applied to nothing:

```ts
  async clearCart(userId: string): Promise<void> {
    const cart = await this.findCartByUserId(userId);
    if (!cart) return;

    await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
    await this.clearAppliedCoupon(userId);
  }
```

- [ ] **Step 4: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm test`
Expected: type-check clean; tests pass at the same count.

- [ ] **Step 5: Commit**

```bash
git add src/domain/cart/interfaces/repositories/cart.repository.interface.ts src/infrastructure/database/repositories/cart/cart.repository.ts
git commit -m "feat(cart): Store an applied coupon on the cart"
```

---

### Task 6: Apply and remove use cases

**Files:**

- Create: `src/application/cart/use-cases/apply-coupon.use-case.ts`
- Create: `src/application/cart/use-cases/remove-coupon.use-case.ts`
- Test: `src/application/cart/use-cases/apply-coupon.use-case.test.ts`
- Modify: `src/application/cart/cart.container.ts`

**Interfaces:**

- Consumes: `CartRepositoryInterface` (Task 5), the existing `ValidateCouponUseCase.execute(code, subtotal, userId)`.
- Produces:
  - `ApplyCouponUseCase.execute(input: { userId: string; code: string }): Promise<ApplyCouponResult>`
  - `interface ApplyCouponResult { applied: boolean; code?: string; error?: string }`
  - `RemoveCouponUseCase.execute(userId: string): Promise<void>`
  - Container getters `getApplyCouponUseCase()`, `getRemoveCouponUseCase()`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { ApplyCouponUseCase } from "./apply-coupon.use-case";
import type { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import type { ValidateCouponUseCase } from "@/application/coupons/use-cases/validate-coupon.use-case";

function cartRepo(subtotal: number): CartRepositoryInterface {
  return {
    getCartTotal: vi.fn(async () => subtotal),
    setAppliedCoupon: vi.fn(async () => undefined),
    clearAppliedCoupon: vi.fn(async () => undefined),
  } as unknown as CartRepositoryInterface;
}

function validator(result: unknown): ValidateCouponUseCase {
  return {
    execute: vi.fn(async () => result),
  } as unknown as ValidateCouponUseCase;
}

describe("ApplyCouponUseCase", () => {
  it("refuses an empty cart without consulting the validator", async () => {
    const repo = cartRepo(0);
    const validate = validator({ valid: true });

    const result = await new ApplyCouponUseCase(repo, validate).execute({
      userId: "user-1",
      code: "PROMO20",
    });

    expect(result.applied).toBe(false);
    expect(result.error).toMatch(/add something to your cart/i);
    expect(validate.execute).not.toHaveBeenCalled();
    expect(repo.setAppliedCoupon).not.toHaveBeenCalled();
  });

  it("stores a valid coupon", async () => {
    const repo = cartRepo(500);
    const validate = validator({
      valid: true,
      coupon: { id: "coupon-1", code: "PROMO20" },
      discountAmount: 100,
    });

    const result = await new ApplyCouponUseCase(repo, validate).execute({
      userId: "user-1",
      code: "promo20",
    });

    expect(result).toEqual({ applied: true, code: "PROMO20" });
    expect(repo.setAppliedCoupon).toHaveBeenCalledWith("user-1", "coupon-1");
  });

  it("validates against the cart's own subtotal", async () => {
    const repo = cartRepo(750);
    const validate = validator({
      valid: true,
      coupon: { id: "coupon-1", code: "PROMO20" },
    });

    await new ApplyCouponUseCase(repo, validate).execute({
      userId: "user-1",
      code: "PROMO20",
    });

    expect(validate.execute).toHaveBeenCalledWith("PROMO20", 750, "user-1");
  });

  it("passes the validator's own message through on refusal", async () => {
    const repo = cartRepo(500);
    const validate = validator({
      valid: false,
      error: "This coupon has expired",
    });

    const result = await new ApplyCouponUseCase(repo, validate).execute({
      userId: "user-1",
      code: "OLD",
    });

    expect(result).toEqual({
      applied: false,
      error: "This coupon has expired",
    });
    expect(repo.setAppliedCoupon).not.toHaveBeenCalled();
  });

  it("does not store a coupon the validator accepted without an id", async () => {
    // Defensive: `valid: true` with no coupon would otherwise write undefined.
    const repo = cartRepo(500);
    const validate = validator({ valid: true });

    const result = await new ApplyCouponUseCase(repo, validate).execute({
      userId: "user-1",
      code: "PROMO20",
    });

    expect(result.applied).toBe(false);
    expect(repo.setAppliedCoupon).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/application/cart/use-cases/apply-coupon.use-case.test.ts`
Expected: FAIL — cannot resolve `./apply-coupon.use-case`.

- [ ] **Step 3: Write `apply-coupon.use-case.ts`**

```ts
/**
 * Apply Coupon Use Case
 *
 * Records which coupon a cart is holding. It does not reserve anything: the
 * code stays available to everyone until an order actually redeems it, and the
 * guarded update in the order repository remains the only thing that decides
 * whether a redemption is allowed.
 *
 * No discount is computed or stored here. The cart remembers the code; the
 * money is worked out once, at checkout, so the two can never disagree.
 */

import { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import { ValidateCouponUseCase } from "@/application/coupons/use-cases/validate-coupon.use-case";

export interface ApplyCouponInput {
  userId: string;
  code: string;
}

export interface ApplyCouponResult {
  applied: boolean;
  code?: string;
  error?: string;
}

export class ApplyCouponUseCase {
  constructor(
    private readonly cartRepository: CartRepositoryInterface,
    private readonly validateCoupon: ValidateCouponUseCase
  ) {}

  async execute(input: ApplyCouponInput): Promise<ApplyCouponResult> {
    const code = input.code.trim().toUpperCase();

    // Minimum-purchase rules are meaningless against an empty cart, and the
    // validator would reject with a confusing message about the minimum
    // rather than the real problem.
    const subtotal = await this.cartRepository.getCartTotal(input.userId);
    if (subtotal <= 0) {
      return {
        applied: false,
        error: "Add something to your cart first, then apply your code.",
      };
    }

    const result = await this.validateCoupon.execute(
      code,
      subtotal,
      input.userId
    );

    if (!result.valid || !result.coupon) {
      return {
        applied: false,
        error: result.error ?? "That code cannot be used right now.",
      };
    }

    // Replaces whatever was applied before — one coupon per cart.
    await this.cartRepository.setAppliedCoupon(input.userId, result.coupon.id);

    return { applied: true, code: result.coupon.code };
  }
}
```

- [ ] **Step 4: Write `remove-coupon.use-case.ts`**

```ts
/**
 * Remove Coupon Use Case
 *
 * Always succeeds, including when no coupon is applied — the customer's intent
 * ("I do not want this code") is satisfied either way, and reporting an error
 * for a cart that is already in the requested state is noise.
 */

import { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";

export class RemoveCouponUseCase {
  constructor(private readonly cartRepository: CartRepositoryInterface) {}

  async execute(userId: string): Promise<void> {
    await this.cartRepository.clearAppliedCoupon(userId);
  }
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm vitest run src/application/cart/use-cases/apply-coupon.use-case.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Wire both into the container**

`createCartModule` needs the coupon validator. It already takes a `deps` argument for the variant repository — extend that pattern rather than importing the coupon module directly, which would create a cycle:

```ts
export interface CartModuleDeps {
  getProductVariantRepository: () => ProductVariantRepositoryInterface;
  getValidateCouponUseCase: () => ValidateCouponUseCase;
}
```

Add memoised getters alongside the existing ones:

```ts
    getApplyCouponUseCase: () =>
      (applyCoupon ??= new ApplyCouponUseCase(
        getCartRepository(),
        deps.getValidateCouponUseCase()
      )),
    getRemoveCouponUseCase: () =>
      (removeCoupon ??= new RemoveCouponUseCase(getCartRepository())),
```

Then update the `createCartModule(...)` call in `src/application/container.ts` to pass `getValidateCouponUseCase` from the coupon module.

- [ ] **Step 7: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm test`
Expected: type-check clean; tests pass, count up by 5.

- [ ] **Step 8: Commit**

```bash
git add src/application/cart/ src/application/container.ts
git commit -m "feat(cart): Add apply and remove coupon use cases"
```

---

### Task 7: Lazy re-validation on cart read

**Files:**

- Modify: `src/application/cart/use-cases/get-cart.use-case.ts`
- Test: `src/application/cart/use-cases/get-cart.use-case.test.ts`

**Interfaces:**

- Consumes: `needsRecheck`, `COUPON_RECHECK_MS` (Task 4); `getAppliedCoupon`, `touchCouponCheckedAt`, `clearAppliedCoupon` (Task 5); `ValidateCouponUseCase`.
- Produces: `GetCartOutput` gains
  `appliedCoupon: { code: string } | null` and
  `couponRemoved: { code: string; reason: string } | null`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { GetCartUseCase } from "./get-cart.use-case";
import { COUPON_RECHECK_MS } from "@/lib/cart-coupon-freshness";
import type { CartRepositoryInterface } from "@/domain/cart/interfaces/repositories/cart.repository.interface";
import type { ValidateCouponUseCase } from "@/application/coupons/use-cases/validate-coupon.use-case";

const NOW = Date.now();

function repo(applied: { checkedAt: Date } | null): CartRepositoryInterface {
  return {
    findByUserId: vi.fn(async () => []),
    getAppliedCoupon: vi.fn(async () =>
      applied
        ? {
            couponId: "coupon-1",
            code: "PROMO20",
            appliedAt: applied.checkedAt,
            checkedAt: applied.checkedAt,
          }
        : null
    ),
    getCartTotal: vi.fn(async () => 500),
    touchCouponCheckedAt: vi.fn(async () => undefined),
    clearAppliedCoupon: vi.fn(async () => undefined),
  } as unknown as CartRepositoryInterface;
}

function validator(result: unknown): ValidateCouponUseCase {
  return {
    execute: vi.fn(async () => result),
  } as unknown as ValidateCouponUseCase;
}

describe("GetCartUseCase coupon freshness", () => {
  it("does not re-validate a coupon checked recently", async () => {
    const repository = repo({ checkedAt: new Date(NOW - 1000) });
    const validate = validator({ valid: true });

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(validate.execute).not.toHaveBeenCalled();
    expect(result.appliedCoupon).toEqual({ code: "PROMO20" });
    expect(result.couponRemoved).toBeNull();
  });

  it("renews a stale coupon that is still valid", async () => {
    const repository = repo({
      checkedAt: new Date(NOW - COUPON_RECHECK_MS - 1000),
    });
    const validate = validator({
      valid: true,
      coupon: { id: "coupon-1", code: "PROMO20" },
    });

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(validate.execute).toHaveBeenCalled();
    expect(repository.touchCouponCheckedAt).toHaveBeenCalledWith("user-1");
    expect(repository.clearAppliedCoupon).not.toHaveBeenCalled();
    expect(result.appliedCoupon).toEqual({ code: "PROMO20" });
  });

  it("drops a stale coupon that is no longer valid and says why", async () => {
    const repository = repo({
      checkedAt: new Date(NOW - COUPON_RECHECK_MS - 1000),
    });
    const validate = validator({
      valid: false,
      error: "This coupon has expired",
    });

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(repository.clearAppliedCoupon).toHaveBeenCalledWith("user-1");
    expect(result.appliedCoupon).toBeNull();
    expect(result.couponRemoved).toEqual({
      code: "PROMO20",
      reason: "This coupon has expired",
    });
  });

  it("says nothing about coupons when none is applied", async () => {
    const repository = repo(null);
    const validate = validator({ valid: true });

    const result = await new GetCartUseCase(repository, validate).execute(
      "user-1"
    );

    expect(validate.execute).not.toHaveBeenCalled();
    expect(result.appliedCoupon).toBeNull();
    expect(result.couponRemoved).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/application/cart/use-cases/get-cart.use-case.test.ts`
Expected: FAIL — `GetCartUseCase` takes one constructor argument.

- [ ] **Step 3: Implement**

`GetCartUseCase` takes the validator as a second constructor argument. After building `items`, and before returning:

```ts
let appliedCoupon: { code: string } | null = null;
let couponRemoved: { code: string; reason: string } | null = null;

const held = await this.cartRepository.getAppliedCoupon(userId);

if (held) {
  if (!needsRecheck(held.checkedAt, Date.now())) {
    // Inside the window: trust the last result and issue no extra query.
    appliedCoupon = { code: held.code };
  } else {
    const check = await this.validateCoupon.execute(
      held.code,
      subtotal,
      userId
    );

    if (check.valid) {
      await this.cartRepository.touchCouponCheckedAt(userId);
      appliedCoupon = { code: held.code };
    } else {
      // Dropped, and the customer is told which code and why rather than
      // finding a smaller discount than they expected at checkout.
      await this.cartRepository.clearAppliedCoupon(userId);
      couponRemoved = {
        code: held.code,
        reason: check.error ?? "That code can no longer be used.",
      };
    }
  }
}

return {
  items,
  subtotal,
  itemCount,
  isEmpty: items.length === 0,
  appliedCoupon,
  couponRemoved,
};
```

Add both fields to `GetCartOutput`. Update the container to pass the validator into `GetCartUseCase`.

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run src/application/cart/use-cases/get-cart.use-case.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Verify the whole suite**

Run: `rm -rf .next && pnpm type-check && pnpm test`
Expected: type-check clean; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/application/cart/
git commit -m "feat(cart): Re-validate a held coupon when it goes stale"
```

---

### Task 8: Router procedures

**Files:**

- Modify: `src/server/routers/public/cart.ts`

**Interfaces:**

- Consumes: `getApplyCouponUseCase()`, `getRemoveCouponUseCase()` (Task 6).
- Produces: `public.cart.applyCoupon`, `public.cart.removeCoupon`. `public.cart.get` now returns `appliedCoupon` and `couponRemoved`.

- [ ] **Step 1: Add both procedures**

```ts
  /**
   * Apply a coupon to the cart.
   *
   * Returns `{ applied: false, error }` rather than throwing: a code that is
   * expired or over its limit is an ordinary answer to a reasonable question,
   * not an exceptional condition, and the field needs the message inline.
   */
  applyCoupon: protectedProcedure
    .input(
      z.object({
        // Bounded because it becomes a database lookup key. Coupon codes in
        // this store are short; 64 is generous.
        code: z.string().trim().min(1).max(64),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const useCase = container.getApplyCouponUseCase();
      return useCase.execute({ userId: ctx.user.id, code: input.code });
    }),

  /** Remove the applied coupon. Succeeds whether or not one was applied. */
  removeCoupon: protectedProcedure.mutation(async ({ ctx }) => {
    await container.getRemoveCouponUseCase().execute(ctx.user.id);
    return { success: true } as const;
  }),
```

- [ ] **Step 2: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: all clean. In particular `src/server/admin-write-gating.test.ts` must still pass — these are `public.*` procedures and are outside its scan, but confirm it did not change count.

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/public/cart.ts
git commit -m "feat(cart): Add apply and remove coupon procedures"
```

---

### Task 9: Checkout reads the coupon from the cart

**Files:**

- Modify: `src/server/routers/public/checkout.ts`
- Modify: `src/components/checkout/` — the client calling `createSession` / `createCodOrder` (locate with `grep -rn "createCodOrder\|createSession" src/components src/app`)

**Interfaces:**

- Consumes: `getAppliedCoupon(userId)` (Task 5).
- Produces: `createSession` and `createCodOrder` inputs **no longer accept `couponCode`**.

`CreateOrderUseCase` is **not modified**. It already takes an optional `couponCode`, already re-validates it server-side and already derives the discount itself. Only where its caller obtains the code changes.

- [ ] **Step 1: Drop `couponCode` from both procedure inputs**

Remove `couponCode: z.string().trim().min(1).optional()` from `createSession` and `createCodOrder`.

- [ ] **Step 2: Read it from the cart in both handlers**

```ts
// The cart owns the applied coupon. Taking it from the request as well
// would be a second source of truth, and the client controls that one.
const held = await container.getCartRepository().getAppliedCoupon(ctx.user.id);
```

Then pass `couponCode: held?.code` where `input.couponCode` was passed.

- [ ] **Step 3: Clear the cart's coupon when checkout rejects it**

`CreateOrderUseCase` throws when a coupon has become invalid, deliberately, so the customer is told rather than silently charged full price. Wrap both call sites so a retry is not stuck on the same dead code:

```ts
try {
  // ...existing use case call
} catch (error) {
  if (held) {
    await container.getCartRepository().clearAppliedCoupon(ctx.user.id);
  }
  throw error;
}
```

- [ ] **Step 4: Update the client**

Remove `couponCode` from both mutation call sites. If the checkout page has its own coupon input, replace it with the shared `CouponField` from Task 10, or delete it and rely on the cart's.

- [ ] **Step 5: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: all clean. Type-check is what proves no caller still passes `couponCode`.

- [ ] **Step 6: Commit**

```bash
git add src/server/routers/public/checkout.ts src/components src/app
git commit -m "feat(checkout): Read the applied coupon from the cart"
```

---

### Task 10: The cart UI

**Files:**

- Create: `src/components/cart/CouponField.tsx`
- Modify: `src/components/cart/CartPopulated.tsx` and `src/components/cart/CartDrawer.tsx`

**Interfaces:**

- Consumes: `trpc.public.cart.applyCoupon`, `trpc.public.cart.removeCoupon`, and `appliedCoupon` / `couponRemoved` from `cart.get`.
- Produces: `<CouponField />`, taking no props — it reads the cart itself.

**There is no DOM testing library in this repo**, so this task has no unit tests. That is a stated limitation, not an omission. Verification is type-check, lint, and running the app.

- [ ] **Step 1: Build the component**

Requirements, all from the spec's decisions:

- **No countdown, no timer, no expiry copy.** The 15 minutes is internal.
- **No discount amount.** Show the code only — the cart did not compute a value and must not imply one.
- When `appliedCoupon` is null: a text input and an "Apply" button.
- When set: a badge showing the code and a remove button.
- On `{ applied: false, error }`: render the error inline beneath the input. Do not toast it — the customer is looking at the field.
- On `couponRemoved` from a `cart.get`: toast it with `sonner`, matching how `cart-provider.tsx` reports errors. This one _is_ a toast: it happened while they were not looking.
- Storefront styling: `bg-val-accent text-black` for the apply button. A plain `<Button>` renders near-invisible on the dark storefront, and `variant="outline"` needs `bg-transparent`.

- [ ] **Step 2: Mount it in both cart surfaces**

Add `<CouponField />` to `CartPopulated.tsx` and `CartDrawer.tsx`, above the subtotal.

- [ ] **Step 3: Verify**

Run: `rm -rf .next && pnpm type-check && pnpm lint && pnpm test`
Expected: all clean.

- [ ] **Step 4: Run it**

Run: `pnpm dev`

Check by hand: apply a valid code (badge appears), apply an invalid one (inline error, no badge), remove (badge goes), reload (badge persists — this is the whole feature), sign out and in (badge persists), empty the cart (coupon clears).

- [ ] **Step 5: Commit**

```bash
git add src/components/cart/
git commit -m "feat(cart): Add coupon field to the cart"
```

---

### Task 11: Update the docs

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Correct the stale guest-cart claim**

`CLAUDE.md`'s Cart section says "Guests cannot add to cart; `addItem` shows a sign-in toast instead." That is **false** — guests hold a localStorage cart that merges at sign-in. It was found stale during this work. Correct it.

- [ ] **Step 2: Document the cart entity**

Add to the Cart section: `carts` is now a real table owning `cart_items` via `cart_id`; `CartRepositoryInterface` stays `userId`-keyed and resolves the cart id internally; `carts.user_id UNIQUE` is what pins one cart per user, and dropping it is the path to saved carts.

- [ ] **Step 3: Document the coupon hold**

State plainly: a coupon on a cart **reserves nothing**, the cart never computes a discount, re-validation is lazy at 15 minutes on read, and the guarded `UPDATE` in `order.repository.ts` remains the only authority on redemption limits. Note that `createSession` / `createCodOrder` no longer accept `couponCode`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: Describe the cart entity and coupon hold"
```

---

## Verification

After Task 11:

```bash
rm -rf .next && pnpm type-check    # clean
pnpm lint                          # 0 problems
pnpm test                          # all pass; ~409 (393 + 16 new)
pnpm build                         # succeeds
```

`pnpm test:integration` needs a database and is 38/41 at baseline for reasons unrelated to this work. If run, confirm no _new_ failures.

## Notes for the implementer

- **Do not touch the coupon redemption guard** in `order.repository.ts`. It closes a race fixed earlier and this feature deliberately does not change redemption.
- **Task 1 will break the build on purpose.** The type errors it produces are the checklist for Tasks 2 and 3. Do not paper over them by keeping `cart_items.user_id`.
- **Tasks 1–3 must land together** before anything is deployable. They are separate tasks because they are separately reviewable, not because they are separately shippable.
- `getAppliedCoupon` joins `coupons` to return the code, because every caller needs it. Do not add a separate code-lookup method.
