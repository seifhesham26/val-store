# P0 Fixes — Manual Test Plan

All seven P0 issues from `docs/ISSUES.md` are implemented. This is what to check, and what "correct" looks like.

**Automated checks already pass:** `pnpm type-check` clean · `pnpm lint` 0 errors / 7 pre-existing warnings · `pnpm test` 36 passed (3 new tests for discounted order totals).

## Before you start

```bash
pnpm dev
```

You need an admin account (`npx tsx scripts/set-admin.ts <your-email>`) and at least one product that has variants with real stock.

- [ ] **Read the "Database" section below first** — the migration folder was rebuilt, and there's one thing to decide before you deploy.
- [ ] Sign out and back in once. The cart's localStorage key changed (`valkyrie-cart` → `valkyrie-cart-v2`), so any old cart in your browser is intentionally discarded.

---

## 1. Product edit no longer wipes detail fields

The bug: every save nulled `gender`, `material`, `careInstructions`, `metaTitle`, `metaDescription`.

- [ ] Go to **Admin → Products → edit any product**. There are two new cards: **Additional Details** (Gender, Material, Care Instructions) and **SEO** (Meta Title, Meta Description).
- [ ] Fill all five in. Put **two or three lines** in Care Instructions — each line becomes a bullet on the storefront.
- [ ] Save. Expected: "Product updated successfully", redirect to the products list.
- [ ] Re-open the same product. **Expected: all five values are still there.** (Before the fix they'd be blank, and the DB columns would be NULL.)
- [ ] Change only the product **name** and save. Re-open. **Expected: the five detail fields are untouched.** This is the actual regression — an unrelated edit used to destroy them.
- [ ] Open the product on the storefront (`/products/<slug>`). **Expected:** the Details list shows your care-instruction lines, one bullet each.
- [ ] Set Gender to **Men**, save, then visit `/collections/men`. **Expected: the product appears.** Set it to Women and confirm it moves to `/collections/women`.

Sale price (fixed at the same time — it could never be cleared before):

- [ ] Set a sale price, save, confirm the storefront shows the sale.
- [ ] Clear the sale price field entirely, save, re-open. **Expected: it stays empty** and the storefront shows the normal price. (Before, the old sale price silently came back.)

Creating a product:

- [ ] **Admin → Products → New**. The same two cards are present. Fill them, publish.
- [ ] Open the new product's edit page. **Expected: everything you entered persisted.** Gender defaults to **Unisex** if untouched.

---

## 2. Order status dropdown

The bug: the dropdown offered `confirmed` (not a real status — it threw), and omitted `paid`.

- [ ] Open **Admin → Orders → any order**. Look at the **Update Status** dropdown.
- [ ] **Expected:** seven options — Pending, Processing, Paid, Shipped, Delivered, Cancelled, Refunded. **No "Confirmed".**
- [ ] **Expected:** options the order can't legally move to are **greyed out and unclickable**. For a `pending` order only Processing, Paid and Cancelled are selectable.
- [ ] Move an order Pending → Processing. **Expected:** "Order status updated", and the dropdown now shows Processing with a _new_ set of enabled options (Paid, Cancelled).
- [ ] Continue Processing → Paid → Shipped → Delivered. **Expected: each step succeeds.** Shipped and Delivered should also stamp the timestamps shown in the Timeline card.
- [ ] On a `delivered` order. **Expected:** only Refunded is selectable; the "Cancel Order" button is gone and "Refund Order" is shown.
- [ ] On a `cancelled` order. **Expected:** everything except the current status is disabled — it's a final state.

> If any status change throws "Invalid order status", tell me the from → to pair; that means the transition map needs widening.

---

## 3. Shipping address on the admin order page

The bug: the card showed a raw UUID instead of an address.

- [ ] Place an order (see §6 for the full flow), then open it in **Admin → Orders**.
- [ ] **Expected:** the Shipping Address card shows a real formatted address — name, street, city/state, postcode, country, and a clickable phone number. **Not a UUID.**
- [ ] **Expected:** Billing Address shows the same address (checkout still reuses the shipping address for billing — that's issue #37, a P3).
- [ ] Open an order placed _before_ today's changes. **Expected:** it also renders properly, since the address is resolved by join at read time, not stored on the order.

---

## 4. Store & Appearance settings save with blank fields

The bug: a blank URL or email field failed validation, so a fresh install couldn't save at all.

- [ ] **Admin → Settings → Store.** Clear **Contact Email** and **Contact Phone**, leave them empty, Save.
- [ ] **Expected: "Store settings saved!"** (Before: a Zod validation error.)
- [ ] **Admin → Settings → Appearance.** Leave **all** social URLs and the logo/favicon blank. Save. **Expected: saved successfully.**
- [ ] Now type `not-a-url` into Instagram and save. **Expected: it still fails**, with "Must be a valid URL". Blank is allowed; invalid is not.
- [ ] Type `hello` into Contact Email and save. **Expected:** fails with "Must be a valid email address".
- [ ] Enter a valid Instagram URL, save, then check the storefront footer. **Expected:** the Instagram icon links to your URL.
- [ ] Clear the Store Name entirely and save. **Expected:** fails with "Store name is required" — that field is genuinely required.

---

## 5. Database / migrations

**What changed:** the `drizzle/` folder contained migrations for an abandoned schema (a uuid `users` table, `password_reset_tokens`) and none of your ~20 real tables. I deleted them and regenerated a single accurate baseline: `drizzle/0000_long_ultragirl.sql` — 27 tables, 10 enums. The old files are backed up outside the repo if you ever want them.

- [ ] `pnpm db:push` still works exactly as before for day-to-day schema changes.
- [ ] Confirm the app still reads/writes normally (any page that loads products).

**Before you deploy — one decision.** Your existing database already has these tables, so running `pnpm db:migrate` against it would try to `CREATE TABLE` things that exist and fail. Two options:

1. **Keep using `db:push` in production too.** Nothing more to do; the baseline is just documentation.
2. **Switch to migrations.** You need to tell Drizzle the baseline is already applied, rather than running it. On the existing DB:
   ```sql
   CREATE SCHEMA IF NOT EXISTS drizzle;
   CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
     id SERIAL PRIMARY KEY,
     hash text NOT NULL,
     created_at bigint
   );
   ```
   then insert a row whose `hash` matches the entry in `drizzle/meta/_journal.json`. From then on `db:migrate` applies only _new_ migrations.

**Tell me which you want** and I'll finish the wiring — option 2 needs the exact hash, which I'd rather generate than have you copy by hand.

- [ ] On a **scratch/empty** database, `pnpm db:migrate` builds the full schema cleanly. (Optional, but it's the real proof the baseline is correct. Don't run this against your working DB.)

---

## 6. Cart remembers size and colour · stock decrements

This is the biggest change. Issue #8 (cart dropped the variant) had to be fixed for #6 (stock never decremented) to be possible at all.

### 6a. The cart records the variant

- [ ] Open a product with several sizes. Pick **size M**, add to cart.
- [ ] Open the cart drawer. **Expected:** the line shows the product name **with the variant underneath** (e.g. "Black / M").
- [ ] Go back, pick **size L** of the _same_ product, add to cart.
- [ ] **Expected: two separate lines** — M and L — not one line with quantity 2. This is the core of the fix.
- [ ] Add the same size M again. **Expected:** the M line goes to quantity 2; still two lines total.
- [ ] Use the hover **Quick Add** wheels on a product card. Pick a size/colour, Add. **Expected:** that exact variant lands in the cart with the right label.
- [ ] Do the same from the **homepage "Best Sellers"** section and from **"You May Also Like"** at the bottom of a product page. **Expected:** both show the size/colour wheels, not a plain "Quick Add" button, and the cart records the variant. _(These two grids weren't loading variants — items added there skipped stock tracking entirely. Found during the post-fix review.)_
- [ ] Open an order in **Admin → Orders**. **Expected:** each line shows the variant under the product name, so you know which size to ship.
- [ ] Same on **Account → Orders → an order**.

### 6b. Stock limits are real

Previously `maxStock` was always 0 because no variant was ever recorded.

- [ ] In **Admin → Inventory**, set one variant's stock to exactly **2**.
- [ ] On the storefront add that variant to your cart, then press **+** in the cart drawer repeatedly. **Expected:** you can reach 2 and the **+ button then disables**.
- [ ] Select a variant whose stock is **0** on the product page. **Expected:** the Add to Cart button reads **Out of Stock** and is disabled — the button now reflects the _selected_ variant, not the product overall.
- [ ] Load a product page fresh, **before picking a size**. **Expected:** the button reads **Add to Cart** and is enabled; clicking it says "Please select a size". It must **not** say "Out of Stock" — that was a regression introduced by the variant work and fixed during review.
- [ ] Pick a size/colour combination that doesn't exist (if your data has one). **Expected:** clicking gives "That combination is not available".

### 6c. Stock actually decrements on purchase

- [ ] Note a variant's current stock in **Admin → Inventory** (say it's 10).
- [ ] Buy 2 of it via **Cash on Delivery** (fastest path — see §7 for checkout).
- [ ] **Expected: stock is now 8.**
- [ ] **Admin → Inventory → History tab.** **Expected:** a new row, change type **sale**, quantity `-2`, previous 10, new 8, reason `Order VLK-…`. This is the first time a purchase has ever appeared in the inventory log.

### 6d. Overselling is blocked

- [ ] Set a variant's stock to **1**.
- [ ] Add **2** of it to your cart (add it, then increase quantity — or set stock to 1 _after_ adding 2).
- [ ] Try to check out. **Expected:** the order is refused with a message like _"Not enough stock for <product> (Black / M). Only 1 left."_ and **no order is created** — check Admin → Orders.
- [ ] **Expected:** stock is still 1, and no `sale` row was added to the inventory log. The whole thing rolls back together.
- [ ] **Expected:** if a coupon was applied, it is **not** consumed either — the coupon usage rolls back with the order.

### 6e. Cancelling restores stock

- [ ] Place a COD order for 2 units, confirm stock dropped by 2.
- [ ] In Admin, set that order to **Cancelled**.
- [ ] **Expected: stock goes back up by 2**, and the Inventory History shows a restock row with reason "Order cancelled — restocked".
- [ ] Do the same on a `delivered` order → **Refunded**. **Expected:** stock restored, logged with change type **return**.

### 6f. One deliberate behaviour change — please confirm you're happy

- [ ] **Account → Wishlist.** The button that said **"Move to Cart"** now says **"Choose Options"** and opens the product page.
- [ ] **Why:** a wishlist entry is a product, not a variant — no size or colour was ever chosen. Adding straight to cart would mean the app silently picking a size for the customer, which is exactly the class of bug we just fixed. Sending them to choose is the standard behaviour.
- [ ] **If you'd rather it added directly**, say so — I can make it auto-add when a product has only one variant and only redirect when there's a real choice.

---

## 7. Coupons actually apply

The bug: the discount was shown in the summary and then thrown away — the customer was charged full price and the coupon was never marked used.

Set up in **Admin → Coupons**: create `TEST20`, percentage, value `20`, active, per-user limit `1`.

### 7a. Cash on Delivery

- [ ] Add items totalling a known amount (say 100).
- [ ] At checkout enter `TEST20`, Apply. **Expected:** green chip, Discount line `-20.00`, Total `80.00`.
- [ ] Place the order with **Cash on Delivery**.
- [ ] **Admin → Orders → that order.** **Expected: the stored total is 80.00, not 100.00.** This is the fix — previously the order saved as 100.
- [ ] **Admin → Coupons.** **Expected:** `TEST20` usage count went from 0 to **1**.
- [ ] Open that order under **Account → Orders**. **Expected:** the summary shows a **Discount** line, so Subtotal − Discount = Total actually adds up. (Without it a customer sees Subtotal 100 / Total 80 with no explanation.)
- [ ] Place a _second_ order with `TEST20` as the same customer. **Expected:** applying the coupon now fails with _"You have already used this coupon the maximum number of times"_ — the per-user limit works now that usage is recorded.

### 7b. Card / Stripe

- [ ] Create another coupon (or raise `TEST20`'s per-user limit) and apply it at checkout.
- [ ] Choose **Card** and continue to Stripe.
- [ ] **Expected: the Stripe checkout page itself shows the discount** and charges the discounted total. (Stripe can't take negative line items, so the discount is applied as a real Stripe coupon on the session.)
- [ ] Complete the test payment. **Expected:** back on the success page, and the order in Admin shows the discounted total and status `paid`.

### 7c. The discount can't be forged

- [ ] Apply a coupon, then **before** placing the order, go to Admin and deactivate that coupon. Come back and place the order.
- [ ] **Expected:** the order is refused with a clear message ("This coupon is no longer active") rather than silently charging full price. The server re-validates the code and derives the discount itself — the browser only ever sends the code, never an amount.

---

## 8. Stripe webhook safety

- [ ] Place a Stripe order but **do not pay** — leave the Stripe page open.
- [ ] In Admin, **cancel** that pending order. **Expected:** stock is restored.
- [ ] Now complete the payment on the still-open Stripe page.
- [ ] **Expected: the order stays `cancelled`.** It must not flip to `paid`, because its stock was already given back. (The webhook now only advances orders that are still `pending`/`processing`.) The payment itself will have gone through, so refund it in Stripe — that part is manual.

---

## Known limitations (by design, not bugs)

- **Stripe abandonment holds stock.** Stock is reserved when the order is created, before the Stripe redirect. If a customer abandons payment, that stock stays on a `pending` order. Recovery today is manual: cancel the order in Admin and the stock comes back (§6e). A scheduled job to auto-cancel stale pending orders would be the proper fix — say the word and I'll add one.
- **Coupon limit race.** Two checkouts submitted at the exact same instant could both pass the usage-limit check. The stock path is protected by row locks; the coupon counter isn't yet.
- **Billing address still mirrors shipping** (issue #37, P3).
- **Currency is still inconsistent** — orders and Stripe use EGP, the UI renders `$` (issue #17, P1).

---

## If something fails

Tell me which checkbox and what you saw. Useful details: the exact error toast, and for server errors the terminal output from `pnpm dev`.
