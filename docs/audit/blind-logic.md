# Blind logic & correctness audit

Scope: `src/domain`, `src/application`, `src/infrastructure`, `src/server`, `src/lib`, `src/hooks`, `src/db`. Read from source only; no docs, tests, or CLAUDE.md consulted. Every finding below was independently re-read from the file at the cited line before being included.

---

- [FOUND] src/infrastructure/database/repositories/orders/order.repository.ts:570 — cancelling an order restocks each line's full original quantity, ignoring units a prior partial refund already put back — high
  - Order has 1 item, quantity 3, paid and shipped (`paymentStatus: "completed"`). Admin records a partial return of 2 units with `restocked: 2` — stock goes from, say, 5 → 7 inside `refund()`, and `refundedQuantity` on the line becomes 2.
  - Admin later cancels the same order (legal: `shipped → cancelled` is in `ORDER_STATUS_TRANSITIONS`) without passing `options.restock` (the admin UI's "omit to restock the whole order" default). `restockByItem` is `null`, so line 568-570 restocks `item.quantity` = 3, not `item.quantity - item.refundedQuantity` = 1.
  - Stock ends up 7 + 3 = 10 instead of 7 + 1 = 8 — the 2 units already returned by the refund are credited to inventory a second time. Nothing in `OrderEntity` or the repository catches this; `stockAlreadyReturned()` only guards the opposite ordering (refund attempted after cancellation).

- [FOUND] src/infrastructure/database/repositories/inventory/inventory.repository.ts:181-190 (`updateVariantStock`), driven by src/application/inventory/use-cases/adjust-stock.use-case.ts:38-62 — stock is read, then written as an unconditional absolute overwrite, with no transaction or row lock — high
  - Variant stock is 10. Admin opens the stock-adjustment dialog; `AdjustStockUseCase.execute` reads `currentStock = 10`.
  - Before the admin submits, a customer completes checkout for 3 units; `DrizzleOrderRepository.create` takes a `FOR UPDATE` lock and commits stock 10 → 7.
  - Admin submits "set to 15" (a top-up they intended on top of the 10 they saw). `updateVariantStock` issues a bare `UPDATE ... SET stock_quantity = 15`, clobbering the 7 with 15 — the customer's 3-unit sale is silently erased from inventory, so 3 more units than actually exist are now sellable.
  - Every other stock-mutating path in the codebase (order creation, cancellation restock, refund restock) explicitly takes `.for("update")` before computing a new value; this is the one path that doesn't, and it's reachable from the admin inventory screen on every "set exact quantity" edit.

- [FOUND] src/infrastructure/database/repositories/products/product-variant.repository.ts:171-185 (`updateStock`), reached via src/application/products/use-cases/update-variant-stock.use-case.ts (`mode: "set"`) — the same class of absolute-overwrite race as above, in a second, independent code path — high
  - Product edit page shows variant stock 10 when the admin opens it. Admin edits stock to 8 (correcting a count) and saves several seconds later.
  - Meanwhile a customer buys 3 of that variant; the order transaction's `FOR UPDATE` decrement moves stock 10 → 7 and commits.
  - `UpdateVariantStockUseCase` with `mode: "set"` never re-reads stock before writing — it passes the admin's stale absolute value straight to `updateStock`, which does `UPDATE ... SET stock_quantity = 8`. The concurrent sale's decrement is discarded; stock reads 8 instead of the correct 7.
  - Contrast with `adjustStock` in the same file, which is race-safe via `GREATEST(0, stock_quantity + delta)` computed in SQL — `updateStock`'s "set" mode has no equivalent protection.

- [FOUND] src/application/cart/use-cases/update-cart-item.use-case.ts:48 — the stock ceiling check is bypassed exactly when the item has zero stock — medium
  - `if (quantity > existingItem.maxStock && existingItem.maxStock > 0)` — when `maxStock` is 0 (item genuinely out of stock), the second clause is `false`, so the whole condition is `false` regardless of `quantity`, and no error is thrown.
  - A cart line exists for a product that has since sold out (`maxStock` now 0). The customer calls `cart.updateItem` with `quantity: 500`. The check is skipped, `cartRepository.updateQuantity` writes 500 straight into the row, and the cart total/UI now shows 500 units of an item with none in stock.
  - `AddToCartUseCase`'s sibling check (`assertWithinStock` in `cart.repository.ts`) has no such `> 0` carve-out and correctly rejects any request that exceeds `available`, including 0 — this is an inconsistency introduced specifically in the update path. Checkout's own `FOR UPDATE` stock check is the only backstop that ultimately prevents an order being placed.

- [FOUND] src/application/orders/use-cases/list-orders.use-case.ts:71-78 — `minTotal`/`maxTotal` are accepted end-to-end from the tRPC input schema but silently dropped before reaching SQL — medium
  - `src/server/routers/admin/orders.ts` accepts `minTotal`/`maxTotal` (lines 19-20) as part of `admin.orders.list`'s input and forwards the whole input object to `ListOrdersUseCase.execute`.
  - `ListOrdersInput` declares both fields (lines 14-15), but the `filters` object built at lines 71-78 only copies `userId`, `status`, `startDate`, `endDate`, `refundableOnly`, `returnedOnly` — `minTotal`/`maxTotal` are never read again anywhere in the file.
  - The repository-level `OrderFilters` interface (`src/domain/orders/interfaces/repositories/order.repository.interface.ts:43-44`) additionally uses different field names (`minAmount`/`maxAmount`), and `DrizzleOrderRepository.buildFiltersConditions` never references `minAmount`/`maxAmount` either — the total-amount filter is unimplemented at every layer. An admin who filters "orders over 1000" gets the full unfiltered list with no indication the filter did nothing.

- [FOUND] src/application/notifications/notification.service.ts:201-223 (`stockSold`) — the "previous stock" used to detect a low-stock crossing is reconstructed from a stock value re-read after other concurrent sales may have already changed it — medium
  - Variant stock is 10, low-stock threshold 5. Order A (qty 4) commits first, stock 10 → 6 — does not cross the threshold on its own, so no notification is warranted yet from A.
  - Before order A's post-commit `stockSold` notifier runs, order B (qty 2) commits, stock 6 → 4, and correctly fires "down to 4" (`previous = 4 + 2 = 6 > 5` → crosses).
  - Order A's notifier now runs. It re-reads _current_ stock via `getVariantsStock`, which already reflects B's sale (4), and computes `previous = 4 + 4 (A's own quantity) = 8`. `crossedLowStock(8, 4)` is true, so A fires a second "down to 4" notification for a crossing it did not itself cause — violating the documented "fires once, on the crossing" invariant and spamming admins with a duplicate alert.

- [FOUND] src/application/categories/use-cases/update-category.use-case.ts:55 — the circular-parent guard only catches a category becoming its own direct parent, not a cycle through its own descendants — medium
  - Category tree: A (root) → B (child of A) → C (child of B).
  - Admin edits A and sets `parentId = C.id`. The guard is `if (input.data.parentId === input.id)`, i.e. `C.id !== A.id`, which passes, so the update is persisted.
  - The category table now contains a genuine cycle (A's parent is C, C's parent is B, B's parent is A) with no true root. `collectCategoryTree`'s "visited" set prevents this from infinite-looping when read, but nothing prevents the cycle from being written, leaving the hierarchy permanently inconsistent (A is simultaneously an ancestor and a descendant of its own descendant C).

- [FOUND] src/application/address/use-cases/address.use-cases.ts:29-43 (`UpdateAddressUseCase`) — changing `addressType` away from "shipping" has none of the "last shipping address" protection that `DeleteAddressUseCase` enforces for the identical resulting state — medium
  - A customer has exactly one address, type "shipping". `DeleteAddressUseCase` explicitly refuses to delete it ("This is your only shipping address...").
  - The same customer calls `address.update` on that address with `data.addressType: "billing"` — a value the input schema accepts freely. `UpdateAddressUseCase.execute` checks only ownership and writes the change.
  - The customer now has zero shipping addresses, the exact state the delete path is designed to prevent, reached instead through the update endpoint. Checkout's `assertAddressesOwnedBy`/shipping-address requirement then has nothing to select from.

- [FOUND] src/infrastructure/database/repositories/dashboard/dashboard.repository.ts:53,61,69,93,157,168 — several `COUNT(*)` aggregates are typed `sql<number>` but never cast to `::int`, so postgres.js returns them as strings at runtime — medium
  - `getMetrics()`'s low-stock query (line 61): with zero variants under the threshold, Postgres returns count `0`; the driver hands back the JS string `"0"`; `lowStockResult.count || 0` evaluates to `"0"` (a non-empty string, truthy) rather than the number `0` — `DashboardMetrics.lowStock` is silently a string where every consumer expects a number.
  - Same pattern at `orders` (line 53), `pendingReviews` (line 69), `getSalesTrend()`'s per-day `count` (line 93), and `getAnalytics()`'s `totalOrders` (line 157) and per-day `revenueTrend[].count` (line 168).
  - The bug is inconsistent within the same file: `getAnalytics()`'s top-products query three lines below (line 180) correctly casts `SUM(...)::int`, showing the cast was known and simply missed at these six call sites. Any arithmetic on these values (e.g. summing across days, or a strict zod number output) either silently string-concatenates or fails validation.

- [FOUND] src/infrastructure/database/repositories/products/product-image.repository.ts:41-60 (`findPrimaryByProduct`) — the fallback lookup for "the primary image" has no `productId` filter, so it can return a different product's image — low (implementation bug is real; currently unreachable — zero callers found anywhere in the codebase)
  - `db.query.productImages.findFirst({ where: eq(productImages.isPrimary, true) })` has no `productId` condition and no deterministic ordering, so it returns an arbitrary row anywhere in the table with `isPrimary = true` — in practice, whichever product's primary image happens to sort first.
  - If product X's own primary image is not that globally-first row, `primary.productId === productId` is false, and the method falls through to `image` — the first row by `displayOrder` for product X, which may not be marked primary at all. Callers would receive a non-primary (or entirely wrong-product-adjacent) image labeled as "the primary image."
  - Currently dead code (no call sites reference `findPrimaryByProduct`), so it cannot fire in production today, but it is a live method on the repository interface and would misbehave immediately if wired into the batch or single-product image lookups the way `findPrimaryByProducts` (the plural, correctly-grouped sibling a few lines below) already is.

- [FOUND] src/lib/auth.ts:265-277 (`databaseHooks.user.create.after`) — the phone→`customers` row check-then-insert has no unique-constraint handling, unlike every other fallible step in the same hook — medium
  - Two sign-up requests carrying the same phone number (e.g. a double-submitted form, or two accounts genuinely sharing a household phone) land close enough together that both run `SELECT ... FROM customers WHERE phone = normalizedPhone` before either has inserted; both see `existing === undefined`.
  - Both call `db.insert(customers).values({ phone: normalizedPhone, ... })`. `customers.phone` carries a unique constraint, so the second insert throws a raw Postgres unique-violation that propagates uncaught out of the `after` hook.
  - The Better Auth `user` row and the `user_profiles` row for that signup were already committed by this point, so the customer gets an error response for a signup that actually succeeded — unlike the phone-normalization block a few lines below and the trailing `customerRegistered` notification call, both of which are deliberately wrapped so a non-critical side effect can't fail an established session; this one isn't.

---

11 findings: 3 high, 7 medium, 1 low. Every finding above traces from source at the cited line and is reproducible from the described interleaving or input — no finding is included without a concrete failure scenario. Areas reviewed and found clean (no reachable logic defect): `OrderEntity`/`OrderStatus` transition and refund-math logic, coupon validation and redemption bookkeeping, `CreateOrderUseCase`'s stock-locking transaction, cart merge (`guest-cart-merge.ts`), category-tree traversal, phone/slug/pagination/like-pattern value objects, all tRPC routers and server utilities (ownership checks, cache-policy gating, rate limiting), and the remaining infrastructure repositories (address, category, coupon, customer, notifications, review, site-config, wishlist, product, revenue queries) and services (Stripe, Resend).
