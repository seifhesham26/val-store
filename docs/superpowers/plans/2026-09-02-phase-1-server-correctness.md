# Phase 1 — Server-side correctness and security: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every server-side correctness and security defect in the remediation queue — including a dead admin gate that has silently disabled all product image uploads — without touching any surface that the Phase 2 palette change will alter.

**Architecture:** Eleven independent tasks against `src/lib`, `src/server`, `src/infrastructure` and `src/application`. Nothing here creates UI, so nothing here needs restyling later. Where a change is enforced by the TypeScript compiler rather than by a test, that is stated explicitly rather than papered over with a fake test.

**Tech Stack:** Next.js 16 App Router, tRPC v11, Drizzle + postgres.js, Better Auth, UploadThing, Upstash rate limiting, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-p3-pass2-design.md` (Revision 2, §3 Phase 1)

## Global Constraints

- **Branch:** `feat/p3-pass2-remediation`. One commit per task; the phase ends with all tasks committed.
- **No writes to the user's database.** No calls to Stripe, Resend or Upstash. `next build` is not run in this phase (it reads the database and no rendering changes here).
- **Gates after every task:** `./node_modules/.bin/tsc --noEmit` clean · `./node_modules/.bin/eslint` 0 errors · `./node_modules/.bin/vitest run` all passing. Baseline is 162 tests, 4 warnings; warnings reach 0 in Task 10.
- **Verify each commit landed:** `git log --oneline -1`. A `git reset HEAD~` was observed from outside this repo's tooling during spec work; content survived but history did not.
- **Prettier:** double quotes, semicolons, 80 cols, es5 trailing commas, LF. `lint-staged` applies it on commit.
- **Commit messages:** conventional, restricted type-enum, **sentence-case subject**, no trailing period, ≤100 chars.
- **Imports:** path alias `@/*` → `src/*`. Match whichever `zod` import style the file already uses; convergence happens in Phase 6, not here.
- **On Windows PowerShell** the runner is `.\node_modules\.bin\vitest.CMD run`; the bash form below is `./node_modules/.bin/vitest run`.

---

## Deviation from the spec, flagged for approval

**Task 9 (#43) does not achieve true transactional atomicity.** The spec says variant metadata and `AdjustStockUseCase` run "in one transaction". `AdjustStockUseCase` reaches the database through `InventoryRepositoryInterface`, which has no transaction-aware executor, so genuine atomicity requires threading a `tx` handle through that interface and its repository — an unplanned refactor of a layer this phase otherwise does not touch.

ISSUES.md #43 explicitly offers the lighter option ("or make the form save them as two visibly separate actions so a partial save is not a surprise"). This plan takes a third position that is strictly better than both: **one server-side procedure, stock adjusted first**. Stock is the operation that validates and writes the audit row, so if it fails nothing is written at all. If the metadata write then fails, the result is an audited stock movement with unchanged metadata — visible in `inventory_logs` and re-appliable — rather than today's silent partial save from the browser.

The tx-threading refactor is recorded as deferred with this reason. **Say so if you want the full refactor instead and Task 9 will be rewritten.**

---

## File Structure

| File                                                                       | Responsibility                                             | Task |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- | ---- |
| `src/server/utils/auth-helpers.ts`                                         | gains `isAdminRole(role)`; `isAdmin(user)` delegates to it | 1    |
| `src/server/utils/auth-helpers.test.ts`                                    | extend — role predicate cases                              | 1    |
| `src/lib/uploadthing.ts`                                                   | real role resolution; duplicate session readers collapsed  | 1    |
| `src/domain/notifications/interfaces/repositories/*.ts`                    | ownership in two signatures                                | 2    |
| `src/infrastructure/.../notifications/*.repository.ts`                     | owner in the WHERE clause                                  | 2, 5 |
| `src/server/routers/{public,admin}/notifications.ts`                       | pass `ctx.user.id`                                         | 2    |
| `src/lib/stores/cart-store.test.ts`                                        | **new** — store behaviour incl. clear                      | 3    |
| `src/components/{account/AccountSidebar,UserDialog,layout/MobileMenu}.tsx` | clear cart before redirect                                 | 3    |
| `src/components/providers/cart-provider.tsx`                               | clear on de-authentication                                 | 3    |
| `src/infrastructure/.../customers/customer.repository.ts`                  | escaped search                                             | 4    |
| `src/server/routers/admin/customers.ts`                                    | escaped search; paginated orders                           | 4, 6 |
| `src/server/routers/public/newsletter.ts`                                  | IP rate limit                                              | 7    |
| `src/lib/auth.ts`                                                          | explicit `rateLimit` block                                 | 7    |
| `src/application/orders/use-cases/send-order-confirmation.use-case.ts`     | **new**                                                    | 8    |
| `src/application/orders/order-address.ts`                                  | **new** — pure address formatting                          | 8    |
| `src/application/orders/order-address.test.ts`                             | **new**                                                    | 8    |
| `src/app/api/webhook/stripe/route.ts`                                      | use the new use case                                       | 8    |
| `src/application/checkout/use-cases/create-order.use-case.ts`              | send COD confirmation                                      | 8    |
| `src/server/routers/admin/variants.ts`                                     | combined update                                            | 9    |
| `src/components/admin/products/create/VariantsSection.tsx`                 | one mutation call                                          | 9    |

---

## Task 1: Make the UploadThing admin gate real

`src/lib/uploadthing.ts:52,81` reads `(session?.session as { role?: string })?.role`. The `session` table has no `role` column (`auth-schema.ts:26-43`) and none is declared in `auth.ts` `additionalFields`, so that value is **always `undefined`** and the comparison `role !== "admin" && role !== "super_admin"` is **always true**. Both `productImage` and `categoryImage` therefore throw `"Admin access required"` for every user including super_admins, and `ImageUploadSection.tsx:226` is the live consumer on the create and edit product forms.

The file also hardcodes the admin role strings that `auth-helpers.ts` already owns. Extracting a predicate fixes the duplication and gives the change a real test.

**Files:**

- Modify: `src/server/utils/auth-helpers.ts:27-29`
- Modify: `src/server/utils/auth-helpers.test.ts`
- Modify: `src/lib/uploadthing.ts:20-29,44-58,73-91,107-110`

**Interfaces:**

- Consumes: `getUserRole(userId: string): Promise<UserRole>` (existing, `auth-helpers.ts:66`)
- Produces: `isAdminRole(role: UserRole): boolean`

- [ ] **Step 1: Write the failing test**

Append to `src/server/utils/auth-helpers.test.ts`:

```ts
describe("isAdminRole", () => {
  it("accepts admin and super_admin", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("super_admin")).toBe(true);
  });

  it("rejects customer and worker", () => {
    expect(isAdminRole("customer")).toBe(false);
    expect(isAdminRole("worker")).toBe(false);
  });

  it("agrees with isAdmin for the same role", () => {
    const roles: UserRole[] = ["customer", "worker", "admin", "super_admin"];
    for (const role of roles) {
      expect(isAdmin({ id: "u", email: "e", name: null, role })).toBe(
        isAdminRole(role)
      );
    }
  });
});
```

Add `isAdminRole` and `type UserRole` to the file's existing import from `./auth-helpers`.

- [ ] **Step 2: Run it and confirm it fails**

Run: `./node_modules/.bin/vitest run src/server/utils/auth-helpers.test.ts`
Expected: FAIL — `isAdminRole is not a function` (or a TS resolution error).

- [ ] **Step 3: Implement the predicate**

Replace `auth-helpers.ts:24-29` with:

```ts
/** Whether a role grants admin access. The single source for that question. */
export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
}

/**
 * Check if a user has admin privileges
 */
export function isAdmin(user: AuthUser): boolean {
  return isAdminRole(user.role);
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `./node_modules/.bin/vitest run src/server/utils/auth-helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Fix the upload gate**

In `src/lib/uploadthing.ts`, replace the imports and the whole `getUser` helper (lines 10-29) with:

```ts
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getUserRole, isAdminRole } from "@/server/utils/auth-helpers";

const f = createUploadthing();

/** The signed-in user, or null. One reader for all three routes. */
async function currentUser() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve the uploader and require admin.
 *
 * The role comes from `user_profiles`, never from the session: the `session`
 * table has no `role` column, so the previous `session.session.role` read was
 * always undefined and this gate rejected everyone, including super_admins.
 */
async function requireAdminUploader() {
  const user = await currentUser();
  if (!user) throw new UploadThingError("Unauthorized");

  const role = await getUserRole(user.id);
  if (!isAdminRole(role)) {
    throw new UploadThingError("Admin access required");
  }

  return { userId: user.id };
}
```

Then replace both admin middlewares with `.middleware(async () => requireAdminUploader())`, change `userAvatar`'s middleware to use `currentUser()`, and delete all four `console.log` calls from the three `onUploadComplete` bodies (keep their `return { url: file.ufsUrl }`; `productImage` already returns, add the same to `categoryImage`, and leave `userAvatar`'s return as is).

- [ ] **Step 6: Gates**

Run: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint && ./node_modules/.bin/vitest run`
Expected: clean, 0 errors, 165 passing.

- [ ] **Step 7: Commit**

```bash
git add src/server/utils/auth-helpers.ts src/server/utils/auth-helpers.test.ts src/lib/uploadthing.ts
git commit -m "fix(uploads): Resolve admin role from user_profiles instead of a session field that does not exist"
git log --oneline -1
```

---

## Task 2: Scope notification reads and deletes to their owner

`markAsRead` and `delete` take only an id in both repositories, so any authenticated user holding another user's notification UUID can mark it read or delete it. The sibling procedures on the same routers (`markAllAsRead`, `getUnreadCount`) already filter correctly — `ctx.user.id` is in scope and simply unused. `admin_notifications` has an `adminUserId` column, so the admin side is a real hole too.

There is no unit test for this: both methods are single Drizzle statements, and the integration suite is read-only by rule. **The enforcement is the compiler** — after the signature change, every call site that omits the owner fails `tsc`. That is stated rather than dressed up.

**Files:**

- Modify: `src/domain/notifications/interfaces/repositories/user-notifications.repository.interface.ts:20,23`
- Modify: `src/domain/notifications/interfaces/repositories/notifications.repository.interface.ts:21,24`
- Modify: `src/infrastructure/database/repositories/notifications/user-notifications.repository.ts:76,110`
- Modify: `src/infrastructure/database/repositories/notifications/notifications.repository.ts:56,88`
- Modify: `src/server/routers/public/notifications.ts:43-66`
- Modify: `src/server/routers/admin/notifications.ts:43-66`

- [ ] **Step 1: Widen both interfaces**

In `user-notifications.repository.interface.ts`:

```ts
  markAsRead(id: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
  delete(id: string, userId: string): Promise<void>;
```

In `notifications.repository.interface.ts`, the same shape with `adminUserId: string` as the second parameter.

- [ ] **Step 2: Run tsc and confirm it fails**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: FAIL — implementations and call sites do not match the new signatures. **Read the error list; it is the complete set of places this defect reaches.**

- [ ] **Step 3: Add the owner to both WHERE clauses**

In `user-notifications.repository.ts`:

```ts
  // Scoped to the owner: an id alone would let any signed-in user act on
  // another user's row. A non-matching row no-ops, which leaks nothing about
  // whether the id exists.
  async markAsRead(id: string, userId: string): Promise<void> {
    await db
      .update(userNotifications)
      .set({ isRead: true })
      .where(
        and(
          eq(userNotifications.id, id),
          eq(userNotifications.userId, userId)
        )
      );
  }

  async delete(id: string, userId: string): Promise<void> {
    await db
      .delete(userNotifications)
      .where(
        and(
          eq(userNotifications.id, id),
          eq(userNotifications.userId, userId)
        )
      );
  }
```

In `notifications.repository.ts`, the same with `adminNotifications` and `adminNotifications.adminUserId`.

- [ ] **Step 4: Pass the owner from all four procedures**

In `src/server/routers/public/notifications.ts`:

```ts
  markAsRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await notificationsRepo.markAsRead(input.id, ctx.user.id);
      return { success: true };
    }),
```

and the same `ctx` addition for `delete`. In `src/server/routers/admin/notifications.ts`, identical changes passing `ctx.user.id`.

- [ ] **Step 5: Gates**

Run: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint && ./node_modules/.bin/vitest run`
Expected: clean, 0 errors, 165 passing.

- [ ] **Step 6: Commit**

```bash
git add src/domain/notifications src/infrastructure/database/repositories/notifications src/server/routers/public/notifications.ts src/server/routers/admin/notifications.ts
git commit -m "fix(notifications): Scope mark-as-read and delete to the notification owner"
git log --oneline -1
```

---

## Task 3: Clear the cart on sign-out

`cart-store.ts` persists `items` — product names, images, unit prices, quantities — to `localStorage` under `valkyrie-cart-v2`, and no sign-out path clears it. All three handlers finish with `window.location.href`, and the full page load rehydrates from disk before any session check runs, so on a shared browser the next person sees the previous account's cart once hydration completes.

`CartProvider` only calls `setItems` when a server cart _arrives_, so for a logged-out visitor the stale cart is never displaced. Fix both: the redirect is the common path, the provider is the backstop.

**Files:**

- Create: `src/lib/stores/cart-store.test.ts`
- Modify: `src/components/account/AccountSidebar.tsx:35-45`
- Modify: `src/components/UserDialog.tsx:31-40`
- Modify: `src/components/layout/MobileMenu.tsx:186-196`
- Modify: `src/components/providers/cart-provider.tsx:37-52`

- [ ] **Step 1: Write the failing test**

Create `src/lib/stores/cart-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "./cart-store";
import type { CartItem } from "./cart-store";

const line = (overrides: Partial<CartItem> = {}): CartItem => ({
  id: "line-1",
  productId: "prod-1",
  variantId: "var-1",
  variantLabel: "M / Black",
  productName: "Shirt",
  productPrice: 100,
  productImage: null,
  quantity: 1,
  maxStock: 5,
  ...overrides,
});

describe("cart store", () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  it("clearCart empties the cart", () => {
    useCartStore.getState().setItems([line(), line({ id: "line-2" })]);
    expect(useCartStore.getState().items).toHaveLength(2);

    useCartStore.getState().clearCart();

    expect(useCartStore.getState().items).toEqual([]);
    expect(useCartStore.getState().isEmpty()).toBe(true);
    expect(useCartStore.getState().getItemCount()).toBe(0);
  });

  it("clearCart leaves nothing that could belong to a previous account", () => {
    useCartStore.getState().setItems([line({ productName: "Private" })]);
    useCartStore.getState().clearCart();

    const serialized = JSON.stringify(useCartStore.getState().items);
    expect(serialized).not.toContain("Private");
  });

  it("getSubtotal reflects quantity and price", () => {
    useCartStore
      .getState()
      .setItems([line({ productPrice: 100, quantity: 2 })]);
    expect(useCartStore.getState().getSubtotal()).toBe(200);
  });
});
```

If `CartItem` is not currently exported from `cart-store.ts`, export the existing interface (`export interface CartItem`) rather than duplicating the shape.

- [ ] **Step 2: Run it and confirm the suite runs**

Run: `./node_modules/.bin/vitest run src/lib/stores/cart-store.test.ts`
Expected: PASS if `CartItem` is exported and `localStorage` resolves under the configured environment; FAIL with a `localStorage is not defined` error if the unit config is node rather than jsdom. If it fails that way, set `environment: "jsdom"` for this file via a `// @vitest-environment jsdom` docblock comment at the top — `jsdom` is already a devDependency.

- [ ] **Step 3: Clear before each sign-out redirect**

`AccountSidebar.tsx` — add the import `import { useCartStore } from "@/lib/stores/cart-store";` and:

```tsx
const handleSignOut = async () => {
  await authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        // The persisted cart belongs to the account that is leaving. Without
        // this the next person on a shared browser rehydrates it from disk.
        useCartStore.getState().clearCart();
        window.location.href = "/";
      },
    },
  });
};
```

`UserDialog.tsx` — the same call, and **delete `localStorage.removeItem("user")`**: nothing in the codebase writes a `"user"` key, and that line reads exactly like the cleanup this was meant to be.

```tsx
const handleLogout = async () => {
  await signOut({
    fetchOptions: {
      onSuccess: () => {
        useCartStore.getState().clearCart();
        window.location.href = "/login";
      },
    },
  });
};
```

`MobileMenu.tsx` — the same call before `onClose()`.

- [ ] **Step 4: Add the provider backstop**

In `cart-provider.tsx`, replace the sync effect with:

```tsx
// Sync server cart to local store
useEffect(() => {
  if (isAuthenticated && serverCart) {
    const items: CartItem[] = serverCart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      variantLabel: item.variantLabel,
      productName: item.productName,
      productPrice: item.productPrice,
      productImage: item.productImage,
      quantity: item.quantity,
      maxStock: item.maxStock,
    }));
    setItems(items);
  }
}, [isAuthenticated, serverCart, setItems]);

// Backstop for the sign-out paths: a logged-out visitor must never be shown
// a cart rehydrated from the previous account's localStorage.
useEffect(() => {
  if (!isAuthenticated) {
    clearCart();
  }
}, [isAuthenticated, clearCart]);
```

Pull `clearCart` from the store alongside the existing `setItems`.

- [ ] **Step 5: Gates**

Run: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint && ./node_modules/.bin/vitest run`
Expected: clean, 0 errors, 168 passing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stores/cart-store.ts src/lib/stores/cart-store.test.ts src/components/account/AccountSidebar.tsx src/components/UserDialog.tsx src/components/layout/MobileMenu.tsx src/components/providers/cart-provider.tsx
git commit -m "fix(cart): Clear the persisted cart on sign-out and when de-authenticated"
git log --oneline -1
```

---

## Task 4: Escape LIKE metacharacters in the two customer searches

`containsPattern` + `ESCAPE` reached `product.repository.ts:350-355` when #22 was fixed, but three sites still interpolate raw. A customer search for `%` produces `%%%`, which matches every row and degenerates to a sequential scan; `_` matches any single character. `escapeLikeTerm` and `containsPattern` are already unit tested in `src/domain/shared/like-pattern.test.ts`, so this is application of a tested helper, not new logic.

**Files:**

- Modify: `src/infrastructure/database/repositories/customers/customer.repository.ts:107-116`
- Modify: `src/server/routers/admin/customers.ts:11,45-53`

- [ ] **Step 1: Fix the customers repository**

Add to the imports:

```ts
import {
  containsPattern,
  LIKE_ESCAPE_CHAR,
} from "@/domain/shared/like-pattern";
import { sql } from "drizzle-orm";
```

Replace the search branch:

```ts
// Escaped so a term containing % or _ matches literally rather than as a
// wildcard — see `containsPattern`. Unescaped, a search for "%" matched
// every row.
const pattern = containsPattern(search);
if (pattern) {
  query = query.where(
    sql`(${customers.phone} ILIKE ${pattern} ESCAPE ${LIKE_ESCAPE_CHAR} OR ${customers.preferredName} ILIKE ${pattern} ESCAPE ${LIKE_ESCAPE_CHAR})`
  ) as typeof query;
}
```

Remove `ilike` and `or` from the drizzle import if nothing else in the file uses them.

- [ ] **Step 2: Fix the admin customers router**

Replace the search branch in `list`:

```ts
const pattern = containsPattern(search);
if (pattern) {
  query = query.where(
    sql`(${user.name} ILIKE ${pattern} ESCAPE ${LIKE_ESCAPE_CHAR} OR ${user.email} ILIKE ${pattern} ESCAPE ${LIKE_ESCAPE_CHAR})`
  ) as typeof query;
}
```

with the matching imports. Leave the `total` count alone — that is P2-10 and belongs to Phase 4, which reworks this router's aggregates anyway.

- [ ] **Step 3: Gates**

Run: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint && ./node_modules/.bin/vitest run`
Expected: clean, 0 errors, 168 passing.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/database/repositories/customers/customer.repository.ts src/server/routers/admin/customers.ts
git commit -m "fix(search): Escape LIKE metacharacters in both customer search paths"
git log --oneline -1
```

---

## Task 5: Pick the primary image for notification thumbnails

`user-notifications.repository.ts:48` builds its thumbnail subquery as `MIN(image_url)` grouped by product — the alphabetically first URL, not the row flagged `isPrimary`. Every other read path in the codebase does `images.find(img => img.isPrimary) ?? images[0]`. It returns _an_ image, which is why it has never looked broken.

**Files:**

- Modify: `src/infrastructure/database/repositories/notifications/user-notifications.repository.ts:44-56`

- [ ] **Step 1: Replace the subquery**

```ts
// The primary image, not the alphabetically first one. DISTINCT ON keeps
// this to a single round trip; the ORDER BY inside it is what selects the
// row, matching `productImageRepository.findPrimaryByProducts()`.
const primaryImage = db
  .select({
    productId: productImages.productId,
    imageUrl: productImages.imageUrl,
  })
  .from(productImages)
  .orderBy(
    productImages.productId,
    desc(productImages.isPrimary),
    asc(productImages.displayOrder)
  )
  .as("primaryImage");
```

Drizzle's query builder has no `distinctOn` helper on `.select()` in this version, so express it as raw SQL instead:

```ts
const primaryImage = sql`(
      SELECT DISTINCT ON (${productImages.productId})
             ${productImages.productId} AS product_id,
             ${productImages.imageUrl}  AS image_url
      FROM ${productImages}
      ORDER BY ${productImages.productId},
               ${productImages.isPrimary} DESC,
               ${productImages.displayOrder} ASC
    )`;
```

- [ ] **Step 2: Confirm which form the version supports**

Run: `./node_modules/.bin/tsc --noEmit`
If the builder form type-checks, keep it and delete the raw-SQL alternative. If it does not, use the raw-SQL form with a `.leftJoin(sql\`\${primaryImage} AS "primaryImage"\`, ...)`and select`sql<string | null>\`"primaryImage"."image_url"\``. **Only one of the two survives into the commit.**

Add `asc` and `desc` to the drizzle import as needed.

- [ ] **Step 3: Gates**

Run: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint && ./node_modules/.bin/vitest run`
Expected: clean, 0 errors, 168 passing.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/database/repositories/notifications/user-notifications.repository.ts
git commit -m "fix(notifications): Use the primary product image for thumbnails"
git log --oneline -1
```

---

## Task 6: Bound the customer detail order fetch

`admin.customers.getById` calls `db.query.orders.findMany` with `with: { items: { with: { product: true } } }` and **no limit** — every order, every line, and every joined product row for that customer. It is the same fetch-everything shape #21 and #25 removed elsewhere, on a screen those sweeps did not reach.

**Files:**

- Modify: `src/server/routers/admin/customers.ts:70-104`

- [ ] **Step 1: Paginate the orders query**

```ts
  getById: adminProcedure
    .input(
      z.object({
        id: z.string(),
        orderLimit: z.number().int().positive().max(100).optional(),
        orderOffset: z.number().int().min(0).optional(),
      })
    )
    .query(async ({ input }) => {
      const customer = await db.query.user.findFirst({
        where: eq(user.id, input.id),
      });

      if (!customer) return null;

      const limit = input.orderLimit ?? 20;
      const offset = input.orderOffset ?? 0;

      // Bounded. This used to load every order with every item and every
      // joined product, which is unbounded in the number of orders a customer
      // has placed.
      const customerOrders = await db.query.orders.findMany({
        where: eq(orders.userId, input.id),
        orderBy: [desc(orders.createdAt)],
        limit,
        offset,
        with: {
          items: {
            with: {
              product: true,
            },
          },
        },
      });

      const [{ orderCount }] = await db
        .select({ orderCount: count() })
        .from(orders)
        .where(eq(orders.userId, input.id));

      return {
        ...customer,
        orderCount,
        // `totalSpent` is deliberately still the naive sum here; Phase 4
        // replaces it with the shared revenue definition alongside the
        // dashboard queries, so the two cannot diverge.
        totalSpent: customerOrders.reduce(
          (sum, o) => sum + parseFloat(o.totalAmount),
          0
        ),
        orders: customerOrders,
        orderLimit: limit,
        orderOffset: offset,
      };
    }),
```

- [ ] **Step 2: Check the consumer still compiles**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean. If `src/app/admin/customers/page.tsx` or a child destructures `orders` expecting the full set, it still receives an array — only its length changes. **If tsc reports a shape error, fix the consumer rather than widening the query back.**

- [ ] **Step 3: Gates**

Run: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint && ./node_modules/.bin/vitest run`
Expected: clean, 0 errors, 168 passing.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/admin/customers.ts
git commit -m "perf(admin): Paginate the customer detail order history"
git log --oneline -1
```

---

## Task 7: Rate-limit the newsletter and pin Better Auth's limits

`newsletter.subscribe` is a `publicProcedure` with no throttle: anyone can insert unlimited rows into `newsletter_subscribers` from anonymous requests. `apiRateLimiter` (100/min) is defined at `rate-limiter.ts:61` and has **zero consumers** — it was built for exactly this. Separately, `betterAuth()` declares no `rateLimit`, so `/api/auth/*` inherits undocumented defaults.

Both limiters no-op silently when `UPSTASH_*` is absent, so local development is unaffected.

**Files:**

- Modify: `src/server/routers/public/newsletter.ts`
- Modify: `src/lib/auth.ts:79-110`

- [ ] **Step 1: Throttle the newsletter by IP**

```ts
import { z } from "zod";
import { publicProcedure, router } from "../../trpc";
import { newsletterSubscribers } from "@/db/schema";
import { db } from "@/db";
import { headers } from "next/headers";
import { TRPCError } from "@trpc/server";
import {
  apiRateLimiter,
  checkRateLimit,
  getClientIp,
} from "@/server/utils/rate-limiter";

export const newsletterRouter = router({
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.string().email("Please enter a valid email address"),
      })
    )
    .mutation(async ({ input }) => {
      // Unauthenticated insert into a table anyone can reach. `apiRateLimiter`
      // existed for this and had no consumer. No-ops without UPSTASH_*.
      const ip = getClientIp(await headers());
      const { allowed } = await checkRateLimit(
        apiRateLimiter,
        `newsletter:${ip}`
      );
      if (!allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again shortly.",
        });
      }

      try {
        await db
          .insert(newsletterSubscribers)
          .values({ email: input.email, isActive: true })
          .onConflictDoNothing({ target: newsletterSubscribers.email });

        return { success: true, message: "Successfully subscribed" };
      } catch (error) {
        console.error("Failed to subscribe to newsletter:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to subscribe to newsletter",
        });
      }
    }),
});
```

- [ ] **Step 2: Pin Better Auth's own limits**

Add to the `betterAuth({...})` config, after the `session` block:

```ts
  /**
   * Stated rather than inherited. The app throttles its own phone-lookup and
   * password-reset paths through Upstash, but sign-in and sign-up run inside
   * Better Auth and were relying on whatever its defaults happened to be.
   */
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 900, max: 10 },
      "/sign-up/email": { window: 3600, max: 5 },
      "/forget-password": { window: 3600, max: 5 },
    },
  },
```

- [ ] **Step 3: Confirm the config type-checks**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: clean. **If Better Auth's types reject `customRules` or a path key, keep `enabled`/`window`/`max` and drop the rules rather than casting** — a silently wrong rule is worse than no rule, and the Upstash limiters already cover the enumeration paths that matter most.

- [ ] **Step 4: Gates**

Run: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint && ./node_modules/.bin/vitest run`
Expected: clean, 0 errors, 168 passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/public/newsletter.ts src/lib/auth.ts
git commit -m "fix(security): Rate-limit newsletter signup and state Better Auth limits explicitly"
git log --oneline -1
```

---

## Task 8: Send a truthful order confirmation on both payment paths

`src/app/api/webhook/stripe/route.ts:102,113` builds the email from the Stripe session rather than the order it has just updated: it sends `session.id.slice(-12).toUpperCase()` as the "order number", which matches nothing the customer can look up, and the literal string `"Address will be confirmed separately"` in place of the address. COD orders get no email at all. `metadata.orderId` is right there, and the real `orderNumber` and a resolved `shippingAddress` are both already on the entity.

The address formatting is pure, so it is extracted and tested; the send itself is I/O and is verified manually.

**Files:**

- Create: `src/application/orders/order-address.ts`
- Create: `src/application/orders/order-address.test.ts`
- Create: `src/application/orders/use-cases/send-order-confirmation.use-case.ts`
- Modify: `src/application/orders/order.container.ts`
- Modify: `src/app/api/webhook/stripe/route.ts:93-123`
- Modify: `src/application/checkout/use-cases/create-order.use-case.ts:113-127`

**Interfaces:**

- Consumes: `OrderAddress` (`order.entity.ts:89`), `OrderRepositoryInterface.findById`, `EmailServiceInterface.sendOrderConfirmation(email, orderNumber, { items, total, shippingAddress })`
- Produces: `formatOrderAddress(address: OrderAddress | null): string`, `SendOrderConfirmationUseCase.execute(input: { orderId: string; email: string }): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/application/orders/order-address.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatOrderAddress } from "./order-address";
import type { OrderAddress } from "@/domain/orders/entities/order.entity";

const address: OrderAddress = {
  fullName: "Nour Hassan",
  addressLine1: "12 Zamalek St",
  addressLine2: "Apt 4",
  city: "Cairo",
  state: "Cairo Governorate",
  postalCode: "11211",
  country: "EG",
  phone: "+201000000000",
};

describe("formatOrderAddress", () => {
  it("renders every populated line in postal order", () => {
    expect(formatOrderAddress(address)).toBe(
      [
        "Nour Hassan",
        "12 Zamalek St",
        "Apt 4",
        "Cairo, Cairo Governorate 11211",
        "EG",
        "+201000000000",
      ].join("\n")
    );
  });

  it("omits an absent second line rather than leaving a blank", () => {
    const formatted = formatOrderAddress({ ...address, addressLine2: null });
    expect(formatted).not.toContain("\n\n");
    expect(formatted).toContain("12 Zamalek St\nCairo,");
  });

  it("degrades to a stated placeholder when there is no address", () => {
    expect(formatOrderAddress(null)).toBe("No shipping address on file");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `./node_modules/.bin/vitest run src/application/orders/order-address.test.ts`
Expected: FAIL — cannot resolve `./order-address`.

- [ ] **Step 3: Implement the formatter**

Create `src/application/orders/order-address.ts`:

```ts
import type { OrderAddress } from "@/domain/orders/entities/order.entity";

/**
 * A resolved order address as a customer would read it.
 *
 * The confirmation email previously printed "Address will be confirmed
 * separately" because it was built from the Stripe session rather than the
 * order. The order carries a resolved `OrderAddress`, so it does not have to.
 */
export function formatOrderAddress(address: OrderAddress | null): string {
  if (!address) return "No shipping address on file";

  const cityLine = [
    [address.city, address.state].filter(Boolean).join(", "),
    address.postalCode,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    address.fullName,
    address.addressLine1,
    address.addressLine2,
    cityLine,
    address.country,
    address.phone,
  ]
    .filter((line): line is string => Boolean(line && line.trim()))
    .join("\n");
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `./node_modules/.bin/vitest run src/application/orders/order-address.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the use case**

Create `src/application/orders/use-cases/send-order-confirmation.use-case.ts`:

```ts
import { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import { EmailServiceInterface } from "@/application/interfaces/email.interface";
import { formatOrderAddress } from "../order-address";

export interface SendOrderConfirmationInput {
  orderId: string;
  email: string;
}

/**
 * Send the order confirmation from the order, not from the payment gateway.
 *
 * Both payment paths call this, so a COD customer and a card customer receive
 * the same message with the same real `VLK-` order number. It absorbs its own
 * failures for the same reason `NotificationService` does: the money has
 * already moved, and an email provider being down must never fail a paid
 * order.
 */
export class SendOrderConfirmationUseCase {
  constructor(
    private readonly orderRepository: OrderRepositoryInterface,
    private readonly emailService: EmailServiceInterface
  ) {}

  async execute(input: SendOrderConfirmationInput): Promise<void> {
    try {
      const order = await this.orderRepository.findById(input.orderId);
      if (!order) {
        console.error("[OrderConfirmation] Order not found:", input.orderId);
        return;
      }

      await this.emailService.sendOrderConfirmation(
        input.email,
        // Assigned at insert and read back on every load, so this is the
        // number the customer can actually quote to support.
        order.orderNumber ?? order.id,
        {
          items: order.items.map((item) => ({
            name: item.variantDetails
              ? `${item.productName} (${item.variantDetails})`
              : item.productName,
            quantity: item.quantity,
            price: item.price,
          })),
          total: order.totalAmount,
          shippingAddress: formatOrderAddress(order.shippingAddress),
        }
      );
    } catch (error) {
      console.error(
        "[OrderConfirmation] Failed to send:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
```

- [ ] **Step 6: Register it in the order module**

In `src/application/orders/order.container.ts`, add a memoised getter alongside the existing ones, following the file's established lazy pattern:

```ts
  getSendOrderConfirmationUseCase: () =>
    (sendOrderConfirmation ??= new SendOrderConfirmationUseCase(
      getOrderRepository(),
      getEmailService()
    )),
```

The email service lives in the services module (`createServicesModule`). If `order.container.ts` cannot reach it without a circular import, take it as a `deps` argument the way `createCheckoutModule` takes its repositories — that is the established pattern for a module that needs to cross domains, and `container.ts` composes it.

- [ ] **Step 7: Use it in the webhook**

Replace `src/app/api/webhook/stripe/route.ts:93-123` with:

```ts
// Send order confirmation email, built from the order rather than the
// Stripe session — the session knows nothing about the VLK- number or
// the shipping address.
if (customerEmail && metadata?.orderId && session.payment_status === "paid") {
  await container.getSendOrderConfirmationUseCase().execute({
    orderId: metadata.orderId,
    email: customerEmail,
  });
}
```

This also removes the `stripeService.getCheckoutSession` round trip the old line-item fetch needed.

- [ ] **Step 8: Send it on the COD path too**

In `create-order.use-case.ts`, the COD branch already clears the cart. Add the send after it. The use case needs the customer's email; take it as an optional `customerEmail` on `CreateOrderInput` and pass it from the checkout router, which has `ctx.user.email`:

```ts
if (input.paymentMethod === "cash_on_delivery") {
  try {
    await this.cartRepository.clearCart(input.userId);
  } catch (error) {
    console.error("[CreateOrder] Failed to clear cart after COD order", error);
  }

  // COD previously received no confirmation at all, while the success page
  // promised one on both paths.
  if (input.customerEmail) {
    await this.sendOrderConfirmation.execute({
      orderId: created.id,
      email: input.customerEmail,
    });
  }
}
```

Add `SendOrderConfirmationUseCase` to the constructor and wire it in `createCheckoutModule`.

- [ ] **Step 9: Gates**

Run: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint && ./node_modules/.bin/vitest run`
Expected: clean, 0 errors, 171 passing.

- [ ] **Step 10: Commit**

```bash
git add src/application/orders src/application/checkout src/app/api/webhook/stripe/route.ts src/server/routers/public/checkout.ts
git commit -m "feat(orders): Send the real order confirmation on both Stripe and COD paths"
git log --oneline -1
```

---

## Task 9: Save variant metadata and stock in one server call

`VariantsSection.tsx:60-77` calls `admin.variants.update` and then `admin.variants.updateStock` one after the other from the browser. If the second fails you get an error toast with the metadata already saved — the shape #20 fixed for product creation, at a smaller scale.

**Read the deviation note at the top of this plan before starting.** This produces one server-side operation with stock first; it is not a database transaction.

**Files:**

- Modify: `src/server/routers/admin/variants.ts:30-39,93-122`
- Modify: `src/components/admin/products/create/VariantsSection.tsx:59-77`

- [ ] **Step 1: Widen the update schema**

```ts
// Stock is optional and separate from the metadata fields on purpose: renaming
// a colour is not an inventory movement. When it IS present the procedure
// routes it through `AdjustStockUseCase`, so every movement still writes an
// `inventory_logs` row saying who changed it and why — #15's rule holds.
const updateVariantSchema = z.object({
  id: z.string().uuid(),
  data: z.object({
    sku: z.string().min(1).max(100).optional(),
    size: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    priceAdjustment: z.number().optional(),
    isAvailable: z.boolean().optional(),
  }),
  stock: z
    .object({
      quantity: z.number().int().min(0),
      changeType: z
        .enum(["restock", "adjustment", "damaged", "return"])
        .default("adjustment"),
      reason: z.string().max(500).optional(),
    })
    .optional(),
});
```

- [ ] **Step 2: Adjust stock before metadata in the procedure**

Insert at the top of the `update` mutation body, before the `repo.findById` call:

```ts
// Stock first, deliberately. It is the operation that validates and
// writes the audit row, so if it fails nothing at all has been written.
// The reverse order can leave metadata saved against a rejected stock
// change, which is the failure the browser-side split already produced.
if (input.stock) {
  const stockResult = await container.getAdjustStockUseCase().execute({
    variantId: input.id,
    newQuantity: input.stock.quantity,
    changeType: input.stock.changeType,
    reason: input.stock.reason,
    userId: ctx.user.id,
  });

  if (!stockResult.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: stockResult.error ?? "Failed to update stock",
    });
  }
}
```

Change the mutation signature to `.mutation(async ({ input, ctx }) => {`. Leave `updateStock` in place — the Inventory page uses it independently.

- [ ] **Step 3: Collapse the two calls in the form**

In `VariantsSection.tsx`, delete `updateStockMutation` and its `useMutation` block, and change the save handler to pass stock inside the single `updateMutation.mutate({ id, data, stock })` call, sending `stock` only when the row's stock was actually edited.

- [ ] **Step 4: Gates**

Run: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint && ./node_modules/.bin/vitest run`
Expected: clean, 0 errors, 171 passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/admin/variants.ts src/components/admin/products/create/VariantsSection.tsx
git commit -m "fix(admin): Save variant metadata and stock in one server operation"
git log --oneline -1
```

---

## Task 10: Clear the lint warnings and untrack build artifacts

Four warnings, one of which hides a real error. Four build artifacts are tracked in git.

**Files:**

- Modify: `src/app/admin/products/page.tsx:8-9`
- Modify: `src/components/home/NewsletterSection.tsx:26-29`
- Modify: `src/domain/products/entities/product-image.entity.ts:75`
- Modify: `.gitignore`
- Delete: `build_output.log`, `build_output3.log`, `type_output.log`, `tmp/tsc_errors.txt`

- [ ] **Step 1: Remove the unused imports**

Delete `import { Plus } from "lucide-react";` and `import { Button } from "@/components/ui/button";` from `src/app/admin/products/page.tsx`.

- [ ] **Step 2: Stop swallowing the newsletter error**

```tsx
    } catch (error) {
      // Logged rather than discarded: the previous catch bound `error` and
      // never used it, so a real failure looked identical to a rejected email.
      console.error("[Newsletter] Subscribe failed:", error);
      toast.error("Failed to subscribe. Please try again.");
    }
```

- [ ] **Step 3: Drop the unused parameter**

```ts
  getThumbnailUrl(): string {
    // For UploadThing, images are served as-is
    // For other CDNs, you might add transformation params
    return this.imageUrl;
  }
```

Run `grep -rn "getThumbnailUrl" src` first; if a caller passes a width, remove the argument at that call site too.

- [ ] **Step 4: Untrack the artifacts**

```bash
git rm --cached build_output.log build_output3.log type_output.log tmp/tsc_errors.txt
printf '\n# build artifacts\n*.log\ntmp/\n' >> .gitignore
rm -f build_output.log build_output3.log type_output.log
```

- [ ] **Step 5: Gates**

Run: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint && ./node_modules/.bin/vitest run`
Expected: clean, **0 errors and 0 warnings**, 171 passing.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: Clear lint warnings and untrack committed build artifacts"
git log --oneline -1
```

---

## Task 11: Determine whether sharp is actually built

`sharp` is among the build scripts pnpm reports as ignored. If it is not built, Next falls back to a slower image path, which partly undoes PERF-47. This task produces a **finding**, not a code change — record it and act only if the answer is bad.

- [ ] **Step 1: Check for a usable binary**

```bash
ls node_modules/.pnpm | grep -i '^sharp@' || echo "sharp not installed"
node -e "try{const s=require('sharp');console.log('sharp OK', s.versions.sharp)}catch(e){console.log('sharp FAILED:', e.message)}"
```

- [ ] **Step 2: Record the result**

If it loads, note it in the Phase 1 completion report and do nothing else.

If it fails, do **not** run `pnpm approve-builds` or reinstall — that rewrites `pnpm-workspace.yaml` and touches the user's install, which is out of bounds for this phase. Record the exact error and hand over the one-line fix (`allowBuilds: { sharp: true }` plus a reinstall) for the user to run. Note that Next.js 16 bundles its own optimiser fallback, so this degrades performance rather than breaking images.

---

## Phase 1 completion

- [ ] All eleven tasks committed; `git log --oneline -11` shows them on `feat/p3-pass2-remediation`
- [ ] `./node_modules/.bin/tsc --noEmit` clean
- [ ] `./node_modules/.bin/eslint` — **0 errors, 0 warnings** (from 4)
- [ ] `./node_modules/.bin/vitest run` — **171 passing** (from 162)
- [ ] `next build` deliberately **not** run: nothing here changes rendering, and it reads the database
- [ ] Findings recorded for the test plan: the sharp result, and whether Better Auth accepted `customRules`

**Not verifiable by any gate — these go into `docs/P3-TEST-PLAN.md` for a human:**

1. Upload a product image as a super_admin. Before this phase it always failed with "Admin access required"; it must now succeed.
2. Sign in as user A, add to cart, sign out, sign in as user B — B's cart must be empty.
3. Complete a COD checkout and confirm the email arrives with a real `VLK-YYYYMMDD-XXXXXX` number and a formatted address. **Requires a verified Resend domain**; until then, confirm the payload in the server log.
4. Edit a variant's colour and stock together and confirm one toast, one `inventory_logs` row, and both changes saved.

---

## Self-review

**Spec coverage.** Every Phase 1 row of spec §3 maps to a task: NEW-1→1, P2-0→2, P2-1→3, NEW-8→4, P2-11→5, NEW-2→6, NEW-3/4→7, #16→8, #43→9, #36/#31→10, sharp→11. No Phase 1 item is unassigned.

**Deliberately deferred within this phase, each with its reason stated at the point of deferral:** `totalSpent` in Task 6 (Phase 4 owns the revenue definition), the `total` count in Task 4 (P2-10, same reason), and true transactional atomicity in Task 9 (flagged for approval above).

**Type consistency.** `isAdminRole(role: UserRole): boolean` is defined in Task 1 and used only there. `formatOrderAddress(address: OrderAddress | null): string` is defined in Task 8 Step 3 and consumed in Step 5 under the same name. `markAsRead(id, userId)` and `delete(id, userId)` keep one signature across the interfaces, both repositories and all four routers in Task 2.

**Two steps intentionally branch** rather than assert an outcome I could not verify without running code: Task 5 Step 2 (whether this Drizzle version exposes a builder form for `DISTINCT ON`) and Task 7 Step 3 (whether Better Auth's types accept `customRules`). Both state which branch to keep and what to do if the preferred one fails, so neither is a placeholder.
