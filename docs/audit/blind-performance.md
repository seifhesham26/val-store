# Performance audit (blind pass)

Scope: `src/infrastructure`, `src/application`, `src/server`, `src/app`, `src/components`. Read directly from source; no project docs consulted. Findings below are verified against the current code with concrete callers and quantified cost. Dead-code candidates I ruled out during the pass (no caller found): `product-image.repository.ts#updateDisplayOrder`, `category.repository.ts#getHierarchy`, `order.repository.ts#findByUserId`/`#findByStatus`, `user-profile.repository.ts#findAll` — these are not listed as findings since nothing on any request path pays for them today.

- [FOUND] src/infrastructure/database/repositories/orders/order.repository.ts:315 — checkout locks and updates each cart line's stock sequentially inside the order transaction instead of batching — high
  - `create()` loops `for (const item of stockedItems)` and does 3 sequentially-awaited statements per item (`SELECT ... FOR UPDATE`, `UPDATE productVariants`, `INSERT inventoryLogs`) — no `Promise.all`, each `await` blocks the next.
  - A 4-item cart costs ~12 sequential round trips for stock alone (~700ms at the documented ~58ms warm round trip) on top of the order/items/payment inserts, all inside the transaction that the checkout mutation awaits before responding.
  - The identical pattern (lock → update → log, sequentially per line item) repeats at line 565 (`updateStatus`, cancellation restock) and line 706 (`processReturn`) — lower traffic (admin actions) but the same shape.
  - The row-locking order is intentionally fixed (sorted by variant id) to avoid deadlocks between concurrent checkouts touching the same variants, so this can't simply be parallelized with `Promise.all` — but the three per-item statements could be collapsed into one bulk `SELECT ... WHERE id = ANY(...) ORDER BY id FOR UPDATE`, one bulk `UPDATE ... FROM (VALUES ...)`, and one bulk `INSERT ... SELECT`, cutting it from `3×N` round trips to 3 regardless of cart size.

- [FOUND] src/application/checkout/use-cases/create-order.use-case.ts:66 — address-ownership check does one `findById` per unique address id, sequentially — medium
  - `assertAddressesOwnedBy` loops `for (const addressId of [...new Set(addressIds)])`, awaiting `addressRepository.findById` each time before checking the next.
  - Runs on every checkout. Shipping and billing addresses differ whenever a customer bills to a different address, so this is 2 sequential round trips (~116ms) instead of 1 — either a single `WHERE id = ANY(...)` query or a `Promise.all` over the (at most 2) ids.

- [FOUND] src/application/checkout/use-cases/create-order.use-case.ts:184 — COD checkout blocks the customer-facing response on a synchronous email send with a redundant DB refetch — high
  - `sendOrderConfirmation.execute()` is `await`ed inline in the checkout flow (line 184), and its own body (`send-order-confirmation.use-case.ts:39`) does `await this.orderRepository.findById(input.orderId)` to reload the order that `orderRepository.create()` had already fully loaded and returned two lines earlier as `created` (`order.repository.ts:416` does its own internal `findById` before returning from `create()`).
  - Net effect on every cash-on-delivery checkout: the same order row is fetched twice from Neon (once inside `create()`, once inside `sendOrderConfirmation`), then the mutation additionally waits on a real Resend API call (`resend-email.service.ts:146`, `sendOrderConfirmation`) before the browser gets its response — a network call to a third party, not a DB round trip, typically the largest single latency contributor on this path (100s of ms).
  - Passing the already-loaded `created` entity into `sendOrderConfirmation` removes the redundant fetch; making the email send fire-and-forget (like `notifications.orderPlaced` conceptually is) would remove it from the response-blocking path entirely.

- [FOUND] src/application/checkout/use-cases/create-order.use-case.ts:193 — two independent post-order notification calls awaited sequentially instead of `Promise.all` — medium
  - `notifications.orderPlaced(...)` (line 193) and `notifications.stockSold(...)` (line 203) don't depend on each other's results, but are `await`ed one after the other on every checkout.
  - `orderPlaced` alone (`notification.service.ts:86-102`) is itself 3 sequential round trips: `fanOutToAdmins` does `findAdminUserIds()` then `createMany()` sequentially (`notification.service.ts:316-321`), followed by a third `await this.userNotifications.create(...)`. All of this sits in front of the checkout response.
  - Combined with the finding above, a COD checkout today pays for roughly: 1 (address check) + up to 12 (stock lines) + 2 (redundant order refetch) + 1 external email call + 3 (notification fan-out) sequential round trips before the customer sees the success page — none of the notification or confirmation work needs to block the response at all.

- [FOUND] src/infrastructure/database/repositories/dashboard/dashboard.repository.ts:41 — `getMetrics()` runs 4 independent count/sum queries sequentially — medium
  - `revenueResult`, `ordersResult`, `lowStockResult`, `reviewsResult` are each a separate `await db.select(...)` in sequence (lines 41, 51, 59, 67), none depending on the others.
  - `getAnalytics()` in the same file (line 146) correctly wraps its 5 independent queries in `Promise.all` — this method is the odd one out.
  - Costs ~3 extra round trips (~174ms at 58ms/round trip) on every load of the admin dashboard overview, the first thing an admin sees after logging in.

- [FOUND] src/server/routers/admin/customers.ts:70 and :100 — customers list and detail each run independent queries sequentially — low
  - `list` (line 70-76): the paginated row query and the total `count()` are awaited one after another rather than `Promise.all`'d — 1 avoidable extra round trip on every admin customers list load.
  - `getById` (line 100-139): `user` lookup, then `orders.findMany` (page of order history), then a separate `SUM`/`count` totals query — the latter two do not depend on the customer row's contents, only on `input.id`, so they could run in parallel with each other (or with the initial lookup). 3 sequential round trips (~174ms) on every "view customer" click in the admin.

- [FOUND] src/infrastructure/database/repositories/reviews/review.repository.ts:72 — admin reviews list has no `LIMIT` — medium (scale-dependent)
  - `findAll(onlyPending = false)` builds a `db.select(...).from(reviews).leftJoin(user, ...)` with no `.limit()`/`.offset()` at all.
  - Caller: `src/server/routers/admin/reviews.ts:27`, `adminProcedure` `list`, called with `onlyPending: false` by default — every load of the admin review-moderation screen fetches every review row ever written, joined to `user`.
  - At today's catalogue size this is small; it has no ceiling, so it degrades linearly with total reviews ever submitted (not just pending ones), unlike every other admin list in this codebase which is paginated.

- [FOUND] src/infrastructure/database/repositories/coupons/coupon.repository.ts:27 — admin coupons list has no `LIMIT` — low
  - `findAll()` is `db.query.coupons.findMany({ orderBy: ... })`, no limit/offset.
  - Caller: `src/server/routers/admin/coupons.ts:44`. Coupon rows are created rarely (admin-authored), so this grows slowly, but it is still unbounded and will eventually be the slowest unpaginated list in the admin if coupon volume grows (e.g. auto-generated single-use codes).

- [FOUND] src/infrastructure/database/repositories/inventory/inventory.repository.ts:157 — admin "All Stock" tab fetches and renders every variant with no pagination on either side — medium (scale-dependent)
  - `getAllVariantsWithStock()` has no `.limit()`; caller `src/server/routers/admin/inventory.ts:20` (`listVariants`) passes nothing through.
  - `src/app/admin/inventory/page.tsx:26-27` calls `trpc.admin.inventory.listVariants.useQuery()` with no args, and `src/components/admin/inventory/AllStockTab.tsx:41` renders `variants.map(...)` directly — no client-side pagination, virtualization, or slicing.
  - At ~36 products × a handful of variants each this is a couple hundred DOM rows, tolerable. It scales linearly with (products × variants-per-product) with no cap in either the query or the render, unlike every other admin list table in the app.

- [FOUND] src/components/home/NewArrivals.tsx:23 — homepage "New Arrivals" carousel fetches client-side on mount instead of being server-rendered — medium
  - `trpc.public.products.list.useQuery(...)` runs in a `"use client"` component with no `initialData`; the section renders 4 skeleton placeholders until the browser completes hydration and a round-trip tRPC call resolves.
  - `src/app/(main)/page.tsx` renders this between `ServerFeaturedCategories` and `PromoBanner` — every sibling product section on the same page (`ServerHeroSection`, `ServerFeaturedCategories`, `ServerFeaturedProducts`) is a server component present in the initial HTML; `NewArrivals` is the one exception, so it is the one section on the homepage that visibly pops in after load and is absent from the server-rendered payload search engines and first paint see.
  - `src/app/(main)/collections/[slug]/page.tsx` documents in its own comments that this exact pattern (client component fetching products after mount) was deliberately fixed there by resolving the first page server-side via `getCachedFirstProductPage` and passing `initialPage` — the same fix was never applied to `NewArrivals`.

- [FOUND] src/components/collections/CollectionSection.tsx:29 — `/collections` index page renders 4 product rows that each fetch client-side on mount — medium
  - `CollectionSection` is a `"use client"` component calling `trpc.public.products.list.useQuery(...)` with no seeded data; `src/app/(main)/collections/page.tsx:98` renders one instance per collection ("New Arrivals", "Men", "Women", "On Sale" — 4 rows, 16 product cards total).
  - The page itself (`CollectionsPage`) is already an `async` server component that correctly resolves the 2 category lookups in parallel via `Promise.all` (line 56) — it stops short of doing the same for the actual product previews, so the page's category metadata is present in the initial HTML while every product grid on it is not, and 4 separate skeleton-then-populate cycles run after hydration.
  - Directly mirrors the `NewArrivals` finding above — same fix (`getCachedFirstProductPage`-style server resolution) is already proven elsewhere in the codebase (`/collections/[slug]`) but not applied to either of these two surfaces.

- [FOUND] src/application/cart/use-cases/merge-guest-cart-items.use-case.ts:73 — guest-cart merge at sign-in writes each cart line sequentially — low/medium
  - `for (const line of merged)` awaits `cartRepository.updateQuantity` or `cartRepository.addItem` one line at a time; each line is an independent row write with no dependency on the others.
  - Runs once per sign-in when a guest had items in localStorage. A cart with 5 distinct lines costs ~5 sequential round trips (~290ms) added to the sign-in flow instead of 1 via `Promise.all`. `buildStockResolver` in the same file (line 132) already does this correctly for its own batch lookups, so the inconsistency is local to this one loop.

- [FOUND] src/infrastructure/database/repositories/products/product.repository.ts:63 — `findAll()` unconditionally eager-loads variants and images that several storefront callers immediately discard — low/medium
  - `findAll` always queries `with: { variants: true, images: true }` (line 68-71), regardless of caller.
  - `src/server/routers/public/products.ts:33` (`withCardData`, used by every `public.products.list`/`search` call) takes the `pageProducts` from `findAll` but never reads `.variants`/`.images` off them — it re-fetches the same data via separate batched calls (`imageRepo.findPrimaryByProducts`, `variantRepo.findByProducts`, lines 40-43) because `findAll`'s relations don't filter to "primary image only" or "available variants only" the way the card view needs.
  - Same pattern in `src/lib/cache.ts:376` (`getCachedRelatedProducts`) and `src/lib/cache.ts:421` (`getCachedProductSlugs`, which only needs `p.slug` and still pulls every variant/image row for every active product on each cache miss).
  - This is wasted data volume rather than extra round trips (Drizzle's relational `with` query and the follow-up `Promise.all` each still cost roughly one pipelined round trip per the stack's postgres.js batching), but at 36 products × ~3-4 variants × ~2 images it's already fetching and discarding on the order of 200+ rows per storefront list/search/related-products call, and it scales with catalogue size. Confirmed by contrast: `list-products.use-case.ts` (admin) _does_ use the eager-loaded `.variants`/`.images` via `product.getPrimaryImage()`/`product.stock`, so this is specifically a storefront-path issue, not a blanket problem with `findAll`.

- [FOUND] src/application/orders/use-cases/cancel-expired-checkouts.use-case.ts:68 — expired-checkout sweep calls Stripe sequentially per stale order — low
  - `for (const { orderId, sessionId } of stale)` awaits `this.wasPaid(sessionId)` (a Stripe API call, `stripe.service.ts`) and then a DB write, one order at a time.
  - Triggered fire-and-forget (`void container.getCancelExpiredCheckoutsUseCase().execute()`) from `public/cart.ts:102`, `public/orders.ts:38`, `admin/orders.ts:74`, throttled to once per minute per process — it does not block the request that triggers it, so it adds no user-facing latency today.
  - Still a real N+1 against an external API: if many checkouts expire in the same window (e.g. after a traffic spike with abandoned Stripe sessions), each Stripe lookup (~100-300ms typical) is paid sequentially rather than via `Promise.all`, so the sweep itself takes proportionally longer to finish per invocation. Low severity only because nothing currently waits on it.
