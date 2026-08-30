# P1 Fixes — Manual Test Plan

Ten of the eleven P1 issues in `docs/ISSUES.md` are implemented. **#16 (the Stripe confirmation email) is deliberately not done** — it is waiting on a real domain being verified in Resend, so there is no point testing a send today. Everything else is below, with what "correct" looks like.

**Automated checks pass:** `pnpm type-check` clean · `pnpm lint` 0 errors / 5 warnings (was 7 — two went away with the webhook rewrite) · `pnpm test` 67 passed · `pnpm build` compiles.

## Before you start

```bash
pnpm db:push     # no schema change was needed, but confirm you are in sync
pnpm dev
```

You need:

- an admin account (`npx tsx scripts/set-admin.ts <your-email>`) — **notifications fan out to every admin**, so if you have several, they all get a row;
- a **second, non-admin** account, to see the customer side of notifications;
- at least one product with variants that have real stock;
- one variant deliberately set to **6 or 7 units**, so you can watch it cross the low-stock line.

One thing to know before anything looks wrong:

- [ ] **Prices now render in EGP, not dollars.** `EGP 1,234.00` where you used to see `$1,234.00`. That is issue #17 and it is intentional — see section 9.

---

## 1. The SKU an admin types is now the SKU that is stored (#9)

The bug: `DrizzleProductRepository.create()` wrote `sku: product.slug` and threw the typed SKU away. `ProductEntity` had no `sku` field at all, so the value had nowhere to travel.

- [ ] **Admin → Products → New**. Type a name, then a **SKU that is clearly not the slug** — e.g. name "Storm Hoodie", slug `storm-hoodie`, SKU `VLK-HOOD-014`.
- [ ] Publish, then check the row in **Drizzle Studio**. **Expected:** `products.sku` is `VLK-HOOD-014`, `products.slug` is `storm-hoodie`. (Before, both said `storm-hoodie`.)
- [ ] Open the product's edit page. **Expected:** a new **SKU** field, populated with what you typed. It sits under Slug and is labelled as the warehouse identifier.
- [ ] Change the SKU, save, re-open. **Expected:** the new value persisted.
- [ ] **Rename the slug** and save. **Expected:** the SKU is unchanged. This is the real regression — the two used to drift apart silently, because the SKU was a stale copy of an old slug.
- [ ] Try to save a SKU that another product already uses. **Expected:** a clear "SKU already exists" error naming **your** SKU — not a Postgres constraint error, and not an error naming the slug (which is what the old duplicate check reported).
- [ ] Re-save a product **without** touching its SKU. **Expected:** it saves. The uniqueness check only runs when the value actually changes, so a product cannot collide with itself.

---

## 2. Creating a product is now one transaction (#20)

The bug: the browser created the product, then looped through images and variants one request at a time, each in its own `try/catch` that only raised a toast. A failure left a product that existed but was missing pieces — and it still redirected.

- [ ] **Admin → Products → New**. Add **two or three images** and **two or three variants** before saving. Publish.
- [ ] **Expected:** one success toast, and the edit page opens with every image and every variant already attached.
- [ ] Now force a failure: add two variants with the **same SKU** and publish. **Expected:** the save is rejected with a duplicate-SKU error, and **no product is created at all**. Check the products list — nothing new. (Before, you would get a product plus one of the two variants plus an error toast.)
- [ ] Fix the SKU and publish again. **Expected:** everything lands.
- [ ] Adding an image or a variant **from the edit page** still works one at a time — that path is unchanged on purpose, because there each change is its own deliberate action.

---

## 3. Stock can no longer be changed without an audit row (#15)

The bug: editing stock on the product page wrote the number straight to the variant. Editing it on the Inventory page went through `AdjustStockUseCase` and logged. The history was silently incomplete.

- [ ] **Admin → Products → edit a product → Variants**. Change a variant's **stock** and save it.
- [ ] Go to **Admin → Inventory → logs**. **Expected:** a new row for that variant — change type **adjustment**, the correct before/after numbers, your name as the author, and the reason "Edited on the product page".
- [ ] Now edit the same variant's **SKU, size or colour** without touching stock, and save. **Expected:** it saves, and **no new inventory log appears.** Renaming a colour is not an inventory movement.
- [ ] Buy something (see section 5). **Expected:** a **sale** row appears in the same log, from the P0 work.
- [ ] Adjust stock from **Admin → Inventory** as before. **Expected:** unchanged behaviour, and both paths' rows sit in the same history and reconcile.

**Known boundary, by design:** creating a _new_ variant with an opening stock figure does not write a log row. That is the opening balance, not a movement. Every change after it is logged.

---

## 4. Wishlist stock is real stock (#18)

The bug: `inStock` was populated from `products.isActive`, so a sold-out product showed as in stock and offered "Move to cart".

- [ ] Add a product to your wishlist as the customer account.
- [ ] In **Admin → Inventory**, set **every variant** of that product to **0**.
- [ ] Reload **/account/wishlist**. **Expected:** the item shows as out of stock and cannot be moved to the cart.
- [ ] Restock **one** variant to 1. Reload. **Expected:** it is in stock again.
- [ ] Deactivate the product in the admin (leaving stock alone). **Expected:** still out of stock — active _and_ in stock are both required.
- [ ] With ten items in the wishlist, watch the server log or network timing. **Expected:** one extra grouped query for the whole page, not one per item.

---

## 5. Reviews are marked as verified purchases (#19)

The bug: `isVerifiedPurchase` was hardcoded `false` and `reviews.orderId` was always null, so the badge could never appear.

- [ ] As the **customer** account that has **never** bought product X, leave a review on X.
- [ ] In Drizzle Studio: **Expected:** `is_verified_purchase = false`, `order_id = null`.
- [ ] Now **buy** product X with that account and let the order reach **paid** (card) or leave it as a COD order and move it to **processing**.
- [ ] Review a _different_ product, Y, that the same order contained. **Expected:** `is_verified_purchase = true` and `order_id` set to that order.
- [ ] Approve it in **Admin → Reviews**, then look at the product page. **Expected:** the verified-purchase badge is shown.
- [ ] Cancel or refund an order and review a product only that order contained. **Expected:** **not** verified — a purchase that came undone does not earn the badge. Only `paid`, `processing`, `shipped` and `delivered` count.

---

## 6. There is an admin Categories page (#13)

The bug: categories were seed-only. `admin.categories.list` existed purely to fill the product dropdown; `create` and `delete` had no UI, and `UpdateCategoryUseCase` was fully written and reachable from nothing.

**The list**

- [ ] **Admin → Categories** (new item in the sidebar, between Products and Orders). **Expected:** every category, ordered by display order, with slug, parent, product count and Active/Hidden.

**Creating**

- [ ] **Add Category**, name only, save. **Expected:** it appears, and the slug was generated from the name.
- [ ] Create one named **`Men's Tees`**. **Expected:** the slug is `mens-tees` — apostrophe gone. This is the value-object fix: the old inline slug code left punctuation in, so creating and renaming produced two different spellings of the same name.
- [ ] Create a category with a **parent** and a **display order**. **Expected:** the parent's name shows in the Parent column, and the row sorts by display order.

**Editing**

- [ ] Rename a category **without touching the slug field**. **Expected:** the slug is regenerated from the new name.
- [ ] Rename it again, this time **typing the old slug explicitly**. **Expected:** the slug you typed is kept — that is how you rename a category without breaking its public URL.
- [ ] Try to save a slug another category already uses. **Expected:** a clear "already exists" error, not a Postgres constraint error.
- [ ] Try to set a category's parent to **itself**. **Expected:** it is not offered in the dropdown. Its own children are not offered either — that would make a cycle.
- [ ] Toggle **Visible in the storefront** off. **Expected:** the row reads Hidden, and the category stops appearing in storefront navigation while keeping its products.

**Deleting — this is the part worth testing hardest**

- [ ] Try to delete a category that **has products**. **Expected:** refused, with a message naming how many. Nothing is deleted.
- [ ] Try to delete one that **has subcategories**. **Expected:** refused, naming how many.
- [ ] Delete an **empty, childless** category. **Expected:** it goes, and the confirmation warns that category deletion is permanent (products soft-delete; categories do not).
- [ ] Confirm the guard is real and not just UI: it lives in `DeleteCategoryUseCase`, so it holds for any caller. Previously deleting a parent orphaned its children — `categories.parent_id` has no foreign key, so they kept pointing at a row that no longer existed.
- [ ] Check the **product form's category dropdown** still populates. It shares the same `list` endpoint, which now also carries counts.

---

## 7. The Featured settings tab controls the homepage (#12)

The bug: the tab wrote to `featured_items` and the homepage read `products.isFeatured` and "the first three active categories". Curating changed nothing. The Add button had no handler and the "drag to reorder" tip described behaviour that was never built.

- [ ] **Admin → Settings → Featured**. **Expected:** each list now shows real **names**, not `ID: 4f3a91b2...`.
- [ ] With both lists empty, open the homepage. **Expected:** Best Sellers shows products marked Featured on their edit page, and the category grid shows the first three active categories. This is the documented fallback — an empty curation must never blank the homepage.
- [ ] Type in the **search box** above Featured Products. **Expected:** matching products appear with an **Add** button. (Before, the box filtered nothing and the button did nothing.)
- [ ] Add three products. Reload the homepage. **Expected:** exactly those three, in the order listed — **not** the `isFeatured` set.
- [ ] Use the **up/down arrows** to reorder. Reload the homepage. **Expected:** the new order. (Arrows rather than drag, because arrows are what actually exists.)
- [ ] Remove one. Reload. **Expected:** gone from the homepage within a second — the write drops the cache tag, so you should not have to wait 60 seconds.
- [ ] Curate **categories** the same way and confirm the homepage grid follows.
- [ ] Now the awkward case: add a product to the featured list, then **deactivate that product**. Reload the homepage. **Expected:** it is skipped, and the rest still render. The admin tab shows it as **Deleted product** so you know why.
- [ ] Empty both lists again. **Expected:** the homepage returns to the fallback behaviour.

---

## 8. Notifications actually get created (#11)

The bug: both notification tables, both repositories, both routers and both bell dropdowns were complete — and nothing anywhere ever called `create()`. Both bells always showed zero.

**Every emit here is deliberately non-fatal.** The service catches and logs its own failures, because an order must never fail over a courtesy message. The tests below therefore check that the _primary_ action always succeeds.

**As a customer**

- [ ] Place an order (COD). **Expected:** the customer bell gets **"Order placed"**.
- [ ] Pay by card and complete Stripe. **Expected:** **"Payment received"**. Return to the success page and refresh it a few times. **Expected:** still exactly one — the success page and the webhook race each other, and only the one that actually transitions the order notifies.
- [ ] In the admin, move the order to **shipped**, then **delivered**. **Expected:** one notification each, naming the real order number.
- [ ] Cancel an order. **Expected:** "Order cancelled". Refund one. **Expected:** "Refund processed".
- [ ] Try an **illegal** status transition (the dropdown will reject it). **Expected:** no notification — the emit happens after the transition is accepted, never before. A customer must not be told their order shipped when it did not.

**As an admin**

- [ ] The same order should have produced a **"New order"** admin notification, with the order number, item count and total.
- [ ] Have the customer submit a review. **Expected:** **"New review awaiting approval"**, with the rating and product name, and "(verified purchase)" when it is one. This is the only thing that tells you the approval queue is non-empty.
- [ ] Sign up a brand-new account. **Expected:** a **"New customer"** admin notification.
- [ ] **Low stock:** take the variant you set to 6 or 7 units and buy enough to push it to **5 or below**. **Expected:** one **"Low stock"** notification naming the **SKU** and the units left.
- [ ] Buy one more of the same variant. **Expected: no second notification.** It fires on the crossing, not on the level — otherwise every subsequent sale of an already-low variant would notify again.
- [ ] Drive it to **0**. **Expected:** nothing new, for the same reason. (It already notified on the way down.)
- [ ] Set stock back up to 20 in **Admin → Inventory**, then adjust it down to 3. **Expected:** a fresh "Low stock" — a new crossing.
- [ ] If you have **two admin accounts**, confirm both got their own copy of every admin notification. They are per-user rows, fanned out in one insert.
- [ ] Mark as read, mark all as read, and delete. **Expected:** all unchanged — those endpoints always worked, they just had nothing to work on.

**The safety property**

- [ ] Optional but worth it: temporarily break the notification insert (rename a column in a scratch DB, or throw inside `NotificationService.fanOutToAdmins`). **Expected:** checkout still completes, the order is still created and stock still decrements. You should see `[Notifications] orderPlaced failed:` in the server log and nothing else go wrong.

---

## 9. Currency is one value everywhere (#17)

The bug: Stripe charged `egp`, the order rows recorded `EGP`, `site_settings.currency` defaulted to `USD`, and every price on the site was rendered with a hardcoded `$`. Customers in Egypt were billed in pounds and shown dollars.

**The decision, so the change is not a surprise:** currency is now **deployment configuration** (`NEXT_PUBLIC_STORE_CURRENCY`, default `EGP`) rather than a database setting, and one helper — `formatCurrency` in `src/lib/currency.ts` — renders every price. A Stripe account is bound to the currency it charges in and every stored price is already denominated in it, so switching currency is a migration, not a dropdown. The Settings dropdown that implied otherwise is gone.

- [ ] Walk the storefront: product cards, product page, search, cart drawer, cart page, checkout summary, order confirmation, **/account/orders** and an order detail. **Expected:** every price reads `EGP 1,234.00`. No `$` anywhere on a computed price.
- [ ] Walk the admin: products list, orders list, order detail (including the refund lines), customers, dashboard metrics, analytics KPIs and charts. **Expected:** the same.
- [ ] **Admin → Settings → Store → Currency.** **Expected:** a read-only row showing `EGP` and a formatted sample, with a note that it is set at deploy time. The dropdown offering USD/EUR/GBP is gone — it never had any effect.
- [ ] Place a **card** order. In Stripe's dashboard, **Expected:** the charge is in **EGP**, and the amount matches what checkout showed, discount included.
- [ ] In Drizzle Studio, check the new `orders.currency` and `payments.currency`. **Expected:** `EGP` in both, matching what Stripe charged.
- [ ] Apply a coupon with a minimum spend you do not meet. **Expected:** the error reads "Minimum purchase of EGP 500.00 required" — the same helper, so the message cannot disagree with the prices next to it.
- [ ] Optional: set `NEXT_PUBLIC_STORE_CURRENCY=USD` in `.env.local` and restart. **Expected:** every price, the Stripe charge and the stored order currency all switch together. Set it back — **do not leave a store with EGP orders configured as USD.**

**Not part of this fix:** the shipping page, the FAQ and the homepage trust badges contain hardcoded dollar copy (`$5.99`, "On orders over $200"). Those are placeholder marketing numbers, not computed prices — converting them would mean inventing EGP prices for your shipping tiers. Tell me the real numbers and I will set them.

---

## 10. Password reset exists (#14)

The bug: `/forgot-password` was an empty directory linked from two live buttons — the login page and the profile's "Change Password" card. Both 404'd. The backend half (`sendResetPassword`, `sendPasswordResetEmail`) was already written.

**What can be tested today, without a domain**

- [ ] Click **Forgot password?** on the login page. **Expected:** the page loads.
- [ ] Click **Change Password** in **/account/profile**. **Expected:** the same page, not a 404.
- [ ] Submit an email that **has** an account. **Expected:** a "Check your email" panel.
- [ ] Submit an email that **does not** have an account. **Expected:** the **identical** panel. This is deliberate: a different response would let a stranger test which addresses are registered.
- [ ] Visit `/reset-password` with **no token**. **Expected:** "This link no longer works", with a button back to request a new one — not a form that cannot possibly work.
- [ ] Watch the server log after a request. **Expected:** either the Resend send, or the existing error line if Resend is not configured. Either way the page behaves the same.
- [ ] Request a reset **four times in an hour** for the same address. **Expected:** the fourth is silently dropped, with `[Auth] Password reset rate limited:` in the log. This uses `passwordResetRateLimiter`, which was defined and unused. **Note:** rate limiting no-ops without `UPSTASH_*` env vars, so locally this may not trigger.

**What needs your domain (do this after Resend is verified)**

- [ ] Request a reset and open the emailed link. **Expected:** `/reset-password?token=…` with the form.
- [ ] Enter a password shorter than 8 characters. **Expected:** rejected client-side.
- [ ] Enter two passwords that differ. **Expected:** "Passwords do not match".
- [ ] Set a valid new password. **Expected:** success toast, redirect to login, and the **new** password works while the old one does not.
- [ ] Open the **same link a second time**. **Expected:** "This link no longer works" — reset tokens are single-use.
- [ ] Wait out the expiry (one hour) and try an old link. **Expected:** the same.

---

## Not done in this pass

- **#16 — the Stripe confirmation email.** It still sends `session.id.slice(-12)` as the order number and the literal text "Address will be confirmed separately", and COD orders get no email at all. The fix is small now that `orderNumber` and a resolved `shippingAddress` are both on the order entity — it is deferred only until your domain is verified in Resend, so it can be tested end to end rather than merely compiled.

---

## When you are done

If everything above holds, `docs/ISSUES.md` should be updated the same way it was after P0: move these ten into the **Resolved** section, keeping their numbers, and leave #16 as the only open P1. I have not done that yet — the catalogue should reflect what you have actually verified, not what I have merely written.
