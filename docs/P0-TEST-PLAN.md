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

- ✅ Go to **Admin → Products → edit any product**. There are two new cards: **Additional Details** (Gender, Material, Care Instructions) and **SEO** (Meta Title, Meta Description).
- ✅ Fill all five in. Put **two or three lines** in Care Instructions — each line becomes a bullet on the storefront.
- ✅ Save. Expected: "Product updated successfully", redirect to the products list.
- ✅ Re-open the same product. **Expected: all five values are still there.** (Before the fix they'd be blank, and the DB columns would be NULL.)
- ✅ Change only the product **name** and save. Re-open. **Expected: the five detail fields are untouched.** This is the actual regression — an unrelated edit used to destroy them.
- ✅ Open the product on the storefront (`/products/<slug>`). **Expected:** the Details list shows your care-instruction lines, one bullet each.
- ✅ Set Gender to **Men**, save, then visit `/collections/men`. **Expected: the product appears.** Set it to Women and confirm it moves to `/collections/women`.

Sale price (fixed at the same time — it could never be cleared before):

- ✅ Set a sale price, save, confirm the storefront shows the sale.
- ✅ Clear the sale price field entirely, save, re-open. **Expected: it stays empty** and the storefront shows the normal price. (Before, the old sale price silently came back.)

Creating a product:

- [ ] **Admin → Products → New**. The same two cards are present. Fill them, publish.
- [ ] Open the new product's edit page. **Expected: everything you entered persisted.** Gender defaults to **Unisex** if untouched.

---

## 2. Order status dropdown

The bug: the dropdown offered `confirmed` (not a real status — it threw), and omitted `paid`.

- ✅ Open **Admin → Orders → any order**. Look at the **Update Status** dropdown.
- ✅ **Expected:** seven options — Pending, Processing, Paid, Shipped, Delivered, Cancelled, Refunded. **No "Confirmed".**
- ✅ **Expected:** options the order can't legally move to are **greyed out and unclickable**. For a `pending` order only Processing, Paid and Cancelled are selectable.
- ✅ Move an order Pending → Processing. **Expected:** "Order status updated", and the dropdown now shows Processing with a _new_ set of enabled options (Paid, Cancelled).
- ✅ Continue Processing → Paid → Shipped → Delivered. **Expected: each step succeeds.** Shipped and Delivered should also stamp the timestamps shown in the Timeline card.
- ✅ On a `delivered` order. **Expected:** only Refunded is selectable; the "Cancel Order" button is gone and "Refund Order" is shown.
- ✅ On a `cancelled` order. **Expected:** everything except the current status is disabled — it's a final state.

> If any status change throws "Invalid order status", tell me the from → to pair; that means the transition map needs widening.

---

## 3. Shipping address on the admin order page

The bug: the card showed a raw UUID instead of an address.

- ✅ Place an order (see §6 for the full flow), then open it in **Admin → Orders**.
- ✅ **Expected:** the Shipping Address card shows a real formatted address — name, street, city/state, postcode, country, and a clickable phone number. **Not a UUID.**
- ✅ **Expected:** Billing Address shows the same address (checkout still reuses the shipping address for billing — that's issue #37, a P3).
- ✅ Open an order placed _before_ today's changes. **Expected:** it also renders properly, since the address is resolved by join at read time, not stored on the order.

> **Note on seeded orders.** The seed script inserts orders with **no address
> and no payment row**, so seeded orders legitimately show "No address on file"
> and "N/A / Awaiting payment". That is correct, not a regression — real orders
> placed through checkout carry both. I confirmed this directly in your data.

---

## 4. Store & Appearance settings save with blank fields

The bug: a blank URL or email field failed validation, so a fresh install couldn't save at all.

- ✅ **Admin → Settings → Store.** Clear **Contact Email** and **Contact Phone**, leave them empty, Save.
- ✅ **Expected: "Store settings saved!"** (Before: a Zod validation error.)
- ✅ **Admin → Settings → Appearance.** Leave **all** social URLs and the logo/favicon blank. Save. **Expected: saved successfully.**
- ✅ Now type `not-a-url` into Instagram and save. **Expected: it still fails**, with "Must be a valid URL". Blank is allowed; invalid is not.
- ✅ Type `hello` into Contact Email and save. **Expected:** fails with "Must be a valid email address".
- ✅ Enter a valid Instagram URL, save, then check the storefront footer. **Expected:** the Instagram icon links to your URL.
- ✅ Clear the Store Name entirely and save. **Expected:** fails with "Store name is required" — that field is genuinely required.

---

## 5. Database / migrations

**What changed:** the `drizzle/` folder contained migrations for an abandoned schema (a uuid `users` table, `password_reset_tokens`) and none of your ~20 real tables. I deleted them and regenerated a single accurate baseline: `drizzle/0000_long_ultragirl.sql` — 27 tables, 10 enums. The old files are backed up outside the repo if you ever want them.

- ✅ **Verified by me (read-only queries against your live DB):** the regenerated
  baseline matches the live schema **exactly** — 27 tables in
  `drizzle/0000_long_ultragirl.sql`, 27 tables in the database, no difference either way.
  The abandoned `users` and `password_reset_tokens` tables from the old
  migrations do not exist, confirming those migrations described a schema you
  never had.
- ✅ **Verified:** the app reads and writes normally — orders, payments,
  addresses, inventory logs and site settings all queried successfully.
- [ ] `pnpm db:push` still works for day-to-day schema changes. _(Not run by me:
      push writes to your schema, and I will not alter your database without you
      asking.)_

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

- [ ] On a **scratch/empty** database, `pnpm db:migrate` builds the full schema
      cleanly. _(Not run by me — it needs a throwaway database, and running it
      against your working one would try to `CREATE TABLE` things that already exist
      and fail. The table-for-table diff above is strong evidence the baseline is
      right; this step is the belt-and-braces proof.)_

---

## 6. Cart remembers size and colour · stock decrements

This is the biggest change. Issue #8 (cart dropped the variant) had to be fixed for #6 (stock never decremented) to be possible at all.

### 6a. The cart records the variant

- ✅ Open a product with several sizes. Pick **size M**, add to cart.
- ✅ Open the cart drawer. **Expected:** the line shows the product name **with the variant underneath** (e.g. "Black / M").
- ✅ Go back, pick **size L** of the _same_ product, add to cart.
- ✅ **Expected: two separate lines** — M and L — not one line with quantity 2. This is the core of the fix.
- ✅ Add the same size M again. **Expected:** the M line goes to quantity 2; still two lines total.
- ✅ Use the hover **Quick Add** wheels on a product card. Pick a size/colour, Add. **Expected:** that exact variant lands in the cart with the right label.
- ✅ Do the same from the **homepage "Best Sellers"** section and from **"You May Also Like"** at the bottom of a product page. **Expected:** both show the size/colour wheels, not a plain "Quick Add" button, and the cart records the variant. _(These two grids weren't loading variants — items added there skipped stock tracking entirely. Found during the post-fix review.)_
- ✅ Open an order in **Admin → Orders**. **Expected:** each line shows the variant under the product name, so you know which size to ship.
- ✅ Same on **Account → Orders → an order**.

### 6b. Stock limits are real

Previously `maxStock` was always 0 because no variant was ever recorded.

- ✅ In **Admin → Inventory**, set one variant's stock to exactly **2**.
- ✅ On the storefront add that variant to your cart, then press **+** in the cart drawer repeatedly. **Expected:** you can reach 2 and the **+ button then disables**.
- ✅ Select a variant whose stock is **0** on the product page. **Expected:** the Add to Cart button reads **Out of Stock** and is disabled — the button now reflects the _selected_ variant, not the product overall.
- ✅ Load a product page fresh, **before picking a size**. **Expected:** the button reads **Add to Cart** and is enabled; clicking it says "Please select a size". It must **not** say "Out of Stock" — that was a regression introduced by the variant work and fixed during review.
- ✅ Pick a size/colour combination that doesn't exist (if your data has one). **Expected:** clicking gives "That combination is not available".

### 6c. Stock actually decrements on purchase

> ✅ **Already confirmed in your database.** Your last two orders wrote real
> `sale` rows to the inventory log:
> `sale -1 9->8 Order VLK-20260829-L4MC46`,
> `sale -1 16->15 Order VLK-20260829-L4MC46`,
> `sale -1 48->47 Order VLK-20260829-6BN00B`.
> This fix is working on live data. The steps below are for re-checking after
> further changes.

- ✅ Note a variant's current stock in **Admin → Inventory** (say it's 10).
- ✅ Buy 2 of it via **Cash on Delivery** (fastest path — see §7 for checkout).
- ✅ **Expected: stock is now 8.**
- ✅ **Admin → Inventory → History tab.** **Expected:** a new row, change type **sale**, quantity `-2`, previous 10, new 8, reason `Order VLK-…`. This is the first time a purchase has ever appeared in the inventory log.

### 6d. Overselling is blocked

- ✅ Set a variant's stock to **1**.
- ✅ Add **2** of it to your cart (add it, then increase quantity — or set stock to 1 _after_ adding 2).
- ✅ Try to check out. **Expected:** the order is refused with a message like _"Not enough stock for <product> (Black / M). Only 1 left."_ and **no order is created** — check Admin → Orders.
- ✅ **Expected:** stock is still 1, and no `sale` row was added to the inventory log. The whole thing rolls back together.
- ✅ **Expected:** if a coupon was applied, it is **not** consumed either — the coupon usage rolls back with the order.

### 6e. Cancelling restores stock

- ✅ Place a COD order for 2 units, confirm stock dropped by 2.
- ✅ In Admin, set that order to **Cancelled**.
- ✅ **Expected: stock goes back up by 2**, and the Inventory History shows a restock row with reason "Order cancelled — restocked".
- ✅ Do the same on a `delivered` order → **Refunded**. **Expected:** stock restored, logged with change type **return**.

### 6f. One deliberate behaviour change — please confirm you're happy

- ✅ **Account → Wishlist.** The button that said **"Move to Cart"** now says **"Choose Options"** and opens the product page.
- ✅ **Why:** a wishlist entry is a product, not a variant — no size or colour was ever chosen. Adding straight to cart would mean the app silently picking a size for the customer, which is exactly the class of bug we just fixed. Sending them to choose is the standard behaviour.
- ✅ **If you'd rather it added directly**, say so — I can make it auto-add when a product has only one variant and only redirect when there's a real choice.

---

## 7. Coupons actually apply

The bug: the discount was shown in the summary and then thrown away — the customer was charged full price and the coupon was never marked used.

Set up in **Admin → Coupons**: create `TEST20`, percentage, value `20`, active, per-user limit `1`.

### 7a. Cash on Delivery

- ✅ Add items totalling a known amount (say 100).
- ✅ At checkout enter `TEST20`, Apply. **Expected:** green chip, Discount line `-20.00`, Total `80.00`.
- ✅ Place the order with **Cash on Delivery**.
- ✅ **Admin → Orders → that order.** **Expected: the stored total is 80.00, not 100.00.** This is the fix — previously the order saved as 100.
- ✅ **Admin → Coupons.** **Expected:** `TEST20` usage count went from 0 to **1**.
- ✅ Open that order under **Account → Orders**. **Expected:** the summary shows a **Discount** line, so Subtotal − Discount = Total actually adds up. (Without it a customer sees Subtotal 100 / Total 80 with no explanation.)
- ✅ Place a _second_ order with `TEST20` as the same customer. **Expected:** applying the coupon now fails with _"You have already used this coupon the maximum number of times"_ — the per-user limit works now that usage is recorded.

### 7b. Card / Stripe

- ✅ Create another coupon (or raise `TEST20`'s per-user limit) and apply it at checkout.
- ✅ Choose **Card** and continue to Stripe.
- ✅ **Expected: the Stripe checkout page itself shows the discount** and charges the discounted total. (Stripe can't take negative line items, so the discount is applied as a real Stripe coupon on the session.)
- ✅ Complete the test payment. **Expected:** back on the success page, and the order in Admin shows the discounted total and status `paid`.

### 7c. The discount can't be forged

- ✅ Apply a coupon, then **before** placing the order, go to Admin and deactivate that coupon. Come back and place the order.
- ✅ **Expected:** the order is refused with a clear message ("This coupon is no longer active") rather than silently charging full price. The server re-validates the code and derives the discount itself — the browser only ever sends the code, never an amount.

---

## 8. Stripe webhook safety

- [ ] Place a Stripe order but **do not pay** — leave the Stripe page open.
- [ ] In Admin, **cancel** that pending order. **Expected:** stock is restored.
- [ ] Now complete the payment on the still-open Stripe page.
- [ ] **Expected: the order stays `cancelled`.** It must not flip to `paid`, because its stock was already given back. (The webhook now only advances orders that are still `pending`/`processing`.) The payment itself will have gone through, so refund it in Stripe — that part is manual.

---

## 9. Follow-ups from your testing round

### 9a. Refunding a paid order that was cancelled

The rule changed: **refundability now follows the money, not the order status.** Cancelling does not un-charge a customer, so a paid-then-cancelled order stays refundable.

- ✅ Take an order to **paid** (card), then **shipped**, then **cancelled**. **Expected:** the Refunded option is still selectable and the "Refund Order" button is still shown — because the money was captured.
- ✅ Take a **pending** order straight to **cancelled** (never paid). **Expected:** Refunded is disabled and the Refund button is hidden — there is nothing to refund.
- ✅ A **delivered COD** order. **Expected:** refundable (cash was collected on delivery).
- ✅ A **shipped COD** order. **Expected:** not refundable yet — the courier hasn't collected.
- ✅ An order already **refunded**. **Expected:** not refundable again.

### 9b. Payment card shows the truth

- ✅ Open any order in Admin. **Expected:** Method reads **Cash on Delivery** or **Card (Stripe)** — it used to always say "N/A" because the payment row was never loaded.
- ✅ **Expected:** Payment Status reads **Awaiting payment / Paid / Paid (on delivery) / Refunded / Failed**, driven by the `payments` row rather than inferred from order status.

### 9c. Refundable filter on the orders list

- ✅ **Admin → Orders.** The "Filters (coming soon)" button is gone. There is now a working **status dropdown**, a **Refundable** toggle, a working **search** box, and a working **Export**.
- ✅ Click **Refundable**. **Expected:** only orders where money was captured and not yet returned — including cancelled ones that were paid.
- ✅ **Expected:** rows that are refundable carry a blue **Refundable** badge next to the payment badge.
- ✅ Pick a status from the dropdown. **Expected:** the list filters server-side. **Clear** resets everything.

### 9d. Cart badge after checkout

The badge used to keep the old count after ordering.

**Second attempt — the first fix addressed the wrong layer.** Emptying the cart
server-side was correct but insufficient: the badge could not re-render at all.
`Navbar` destructured `getItemCount` from the store and called it during
render. That function reference never changes, so with the React Compiler
enabled the call was memoised against dependencies that are constant — the
count froze at whatever it was on first render, no matter what the store did
afterwards. It now reads through a selector returning a number, which
subscribes properly.

The success page also clears the local cart directly on confirmation rather
than waiting for the refetch to report it, so there is no window where the old
count is still on screen. That is guarded on payment actually being confirmed —
an abandoned Stripe checkout keeps the customer's cart.

- [ ] Place a **COD** order. **Expected:** the navbar cart badge drops to 0 immediately on the success page. _(The cart is now emptied server-side when a COD order is created, instead of relying on the browser.)_
- [ ] Place a **Stripe** order and complete payment. **Expected:** badge is 0 when you land back on the success page.
- [ ] Add items, then change quantities in the drawer. **Expected:** the badge
      tracks every change live — this is the same freeze, and it would have
      been broken here too.
- [ ] Start a **Stripe** checkout and abandon it (back button from Stripe).
      **Expected:** the badge still shows your items — an unpaid checkout must
      not empty the cart.
- [ ] Hard-refresh the success page. **Expected:** still 0 — it is not coming back from localStorage.

### 9e. Stripe order marked paid without a webhook

- [ ] Pay with `4242 4242 4242 4242`. **Expected:** on returning to the success page the order shows **paid** in Admin, and Payment Status is **Paid** — even if you are **not** running `stripe listen`.
- [ ] **Expected:** the cart is emptied too.
- [ ] If you _are_ running `stripe listen --forward-to localhost:3000/api/webhook/stripe`, it should still be paid exactly once — both paths are idempotent and guarded.
- [ ] Reload the success page a few times. **Expected:** no duplicate effects, status stays `paid`.

---

## 10. Cached stock + stock issue dialog

Stock is now fetched once per set of variants, cached by TanStack Query, and
refreshed every 60 seconds (and on window focus). The UI knows every limit up
front instead of discovering it from a rejected request.

- ✅ Open a product page. **Expected:** the quantity stepper caps at the
  variant's stock and "Only N left" appears at 5 or fewer.
- ✅ Leave the page open, change that variant's stock in **Admin → Inventory**,
  wait ~60s (or switch tabs and back). **Expected:** the cap updates without
  a reload.
- ✅ With the page open, reduce stock to 1 in another tab, then immediately try
  to add 3 before the refresh lands. **Expected:** a **dialog** — not a
  toast — showing the product image, name, variant, "You wanted 3",
  "Available 1", and an **"Add 1 instead"** button.
- ✅ Click "Add 1 instead". **Expected:** the quantity drops to 1.
- ✅ Set stock to 0 and retry. **Expected:** the dialog says **Out of stock**
  and offers no quantity button.
- ✅ Same checks via the hover **Quick Add** wheels on a product card.
- ✅ Open the network tab on a product grid. **Expected:** stock is fetched in
  a single batched request, not one per card.

## 11. Cancelling / refunding with a reason and partial restock

Cancel and refund no longer fire immediately — both open a dialog.

- ✅ On an order, choose **Cancelled** from the dropdown (or the Cancel Order
  button). **Expected:** a dialog listing every item with its image,
  variant, and a stepper defaulting to the full quantity.
- ✅ **Expected:** the confirm button is disabled until a **reason** is chosen.
- ✅ Confirm with everything at full quantity. **Expected:** the order is
  cancelled and all stock returns, exactly as before.
- ✅ Cancel another order but set one line's restock to **0** (e.g. a damaged
  item). **Expected:** an amber warning appears explaining the shortfall
  stays out of inventory; after confirming, **only the selected units** are
  returned.
- ✅ **Admin → Inventory → History.** **Expected:** the restock rows carry your
  reason, e.g. `Order cancelled: Item arrived damaged`.
- ✅ Refund a paid order. **Expected:** the same dialog with refund-specific
  reasons, and log entries of type **return**.
- ✅ Check the order afterwards. **Expected:** the reason is appended to the
  order's admin notes with a timestamp.
- ✅ Cancel an order placed **before** variant tracking. **Expected:** the
  dialog says none of the items are linked to a stock record — nothing to
  return.

### Restock quantities are bounded on both sides

Returning more units than were ordered would create stock out of nothing.

- [ ] In the dialog, each line's stepper now reads **`2/3`** — chosen over
      ordered — and the **+** button stops at the ordered quantity.
- [ ] Call `admin.orders.updateStatus` directly with a restock quantity higher
      than the line's, e.g. 99 on a line of 2. **Expected:** rejected with
      "only 2 were ordered". It used to be silently clamped, which hid the
      mistake instead of reporting it.
- [ ] Same with an `orderItemId` from a different order. **Expected:** "that
      line is not part of this order". Previously ignored in silence.
- [ ] Same line listed twice, or a negative/fractional quantity.
      **Expected:** rejected.

---

## 12. Cart is reconciled against live stock (the mid-journey gap)

**What was wrong:** stock was checked when an item was added, and again inside
the order transaction — with nothing in between. Anything that moved while the
item sat in the cart (someone else buying the last one, an admin adjustment, a
variant withdrawn) stayed invisible until the final button, and then arrived as
a toast you couldn't act on. That is exactly what you hit.

**What happens now:** while you are looking at the cart — drawer open, `/cart`,
or anywhere under `/checkout` — the cart is re-checked against live stock every
**15 seconds**, on window focus, and on demand before the order is placed. A
problem opens a dialog naming the item, the variant, how many are actually left,
and every route out: keep what's left, remove it, or switch to a variant that
is in stock.

### Setup

Put an item in your cart, then in a second window go to
**Admin → Inventory** and drop that variant's stock below what you're holding.

### The checks

- ✅ With the cart drawer **open**, drop the stock in Admin. **Expected:**
  within ~15 seconds the dialog appears by itself — no click needed. It
  shows the product image, name, variant, "In your cart N", "Available M".
- ✅ **Expected:** the line in the drawer behind it shows an amber
  "Only M left", and the green **Checkout** button is replaced by an amber
  **Review stock changes** button.
- ✅ Press **Keep M**. **Expected:** the quantity drops to M, the dialog closes
  by itself, and Checkout returns to normal.
- ✅ Repeat, but press **Remove**. **Expected:** the line disappears.
- ✅ Set the variant's stock to **0** in Admin. **Expected:** the dialog title
  reads "An item sold out", there is no _Keep_ button, and — if the product
  has other variants in stock — an **Available in** row of chips such as
  `Black / S · 4 left`, with the chip that matches the size you chose marked
  **same size** and listed first.
- ✅ Press one of those chips. **Expected:** the cart line switches to that
  variant, keeping your quantity (or as much of it as that variant has).
- ✅ With several broken lines at once, press **Update my cart**.
  **Expected:** every line is either reduced to what's left or removed, and
  the dialog closes. It does **not** pick a substitute variant for you —
  that's a choice, not a correction.
- ✅ Press **Decide later**. **Expected:** the dialog closes and stays closed —
  but change the stock again in Admin and it comes back, because the problem
  is now a different one.
- ✅ Go to `/cart` (the full page). **Expected:** same behaviour, and the
  **Proceed to Checkout** button is likewise replaced.
- ✅ **The original bug.** Load `/checkout`, then drop the stock in Admin, then
  press **Complete Order**. **Expected:** the button briefly reads
  "Checking stock...", then the dialog opens. The order is **not** created
  and you get **no toast**.
- ✅ Fix it in the dialog, then press **Complete Order** again. **Expected:**
  the order goes through normally.
- ✅ Browse a product page (not the cart) while stock changes. **Expected:**
  **no** dialog interrupts you — the modal only appears where you can act on
  it. The product page's own quantity ceiling still updates within 15s.
- ✅ Sanity check that nothing regressed: place an ordinary order with plenty
      of stock. **Expected:** no dialog, no extra delay.

### Note on the final gate

The `SELECT … FOR UPDATE` check inside the order transaction is still there and
still authoritative — two people racing for the same last unit is decided there,
not in the browser. What changed is that you should now essentially never reach
it, and if the pre-check itself fails for any reason the order is still allowed
through to that lock rather than being blocked by a broken check.

---

## 13. Coupons: editing, and why WELCOME10 was rejected

**The expiry was real, not a bug.** Every seeded coupon in your database had
already expired — they were seeded around February with 60–90 day windows, so
the latest of them died on 25 May. Validation was doing its job:

| Code      | Expired    |
| --------- | ---------- |
| VIP50     | 2026-03-10 |
| FLAT20    | 2026-03-26 |
| FREESHIP  | 2026-04-10 |
| SUMMER25  | 2026-04-25 |
| WELCOME10 | 2026-05-25 |

The admin table hid this: it showed the stored `isActive` flag, so all of them
displayed a healthy green **Active** while checkout refused them. That was the
actually misleading part.

**The edit dialog was a real bug.** It was a pure uncontrolled form that never
received the coupon — only a boolean saying "you are editing". So Edit opened a
blank Create form, and saving it re-sent whatever was on screen: the discount
type silently reset to **Percentage**, the Active switch reset to **on**, and
the code had to be retyped from memory. `perUserLimit` and `startsAt` had no
inputs at all and were unreachable from the UI.

### The checks

- ✅ **Admin → Coupons.** **Expected:** the expired codes now read **Inactive**
  with **Expired** underneath. `FREESHIP` reads Inactive / **Switched off**.
  A coupon at its usage limit reads **Usage limit reached**.
- ✅ Open the **⋯ → Edit** menu on WELCOME10. **Expected:** every field is
  filled in — code, description, Percentage, 10, min purchase 50, usage
  limit 1000, per-customer limit 1, and the old expiry date.
- ✅ Change the expiry to a date next month and save. **Expected:** the row
  flips to green **Active** with no reason line.
- ✅ Edit a _fixed_-amount coupon (FLAT20). **Expected:** the type shows
  **Fixed Amount**, not Percentage — this is what previously reset itself.
- ✅ Clear the **Max Discount Amount** on SUMMER25 and save, then reopen.
  **Expected:** it stays empty. (Blank now means "clear it"; previously
  blank meant "leave whatever was there", so a limit could never be removed.)
- ✅ Set an expiry of **today** and use the code at checkout. **Expected:** it
  works. A date input gives a bare day, and that day is now valid to
  23:59:59 — previously it meant midnight _this morning_, so a coupon
  expiring today was already dead.
- ✅ Edit one coupon, close, then edit a different one. **Expected:** the
  second dialog shows the second coupon's values, not the first's.

### Then re-run §7

- ✅ Place a COD order with a live WELCOME10 on a subtotal over $50.
  **Expected:** 10% comes off, the order stores the discount, and
  `coupon_usages` gains a row (§7).
- ✅ Try the same coupon again as the same customer. **Expected:** rejected —
  per-customer limit is 1.

**Not done deliberately:** an expired coupon's stored `isActive` flag is left
alone rather than being flipped to false on read. If it were flipped, pushing
the expiry date out later would silently leave the coupon switched off. Say the
word if you would rather it were persisted.

---

## 14. Stripe checkout with a coupon

**What broke:** the per-session Stripe coupon was named
`Order <uuid> discount` — 51 characters against Stripe's 40-character limit, so
**every** card checkout carrying a discount failed with a 500. Card checkout
without a coupon was unaffected, which is why this only appeared now. The order
id has moved to the coupon's metadata and the name is now the coupon code.

**What it exposed:** the order and its stock reservation are created _before_
the Stripe call. When Stripe threw, the order stayed `pending` and kept holding
stock nobody was buying. That is now unwound — a failed hand-off cancels the
order and returns its stock.

### The checks

- ✅ Card checkout **with** a coupon applied. **Expected:** you reach Stripe's
  hosted page, and the discount is listed there as a line off the total.
- ✅ Pay with `4242 4242 4242 4242`. **Expected:** the order goes to **paid**
  and the charge equals the discounted total, not the full one.
- ✅ Card checkout **without** a coupon. **Expected:** unchanged.
- ✅ To confirm the unwind: temporarily break the Stripe key in `.env`, try a
      card checkout, and check Admin → Orders. **Expected:** an error, and
      **no** lingering `pending` order — it is cancelled, with stock returned
      and the reason "Payment could not be started".

### Clean-up you may want

Your two failed attempts this morning left orders holding stock:

- `VLK-20260830-ZYECIS` — 2 units
- `VLK-20260830-C4Q0L8` — 2 units

Both are `pending` and never reached Stripe. Cancel them in **Admin → Orders**
and the 4 units come back (this also exercises §11). Older `pending` orders
predate stock reservation and hold nothing.

---

## 15. Unpaid card orders: the 30-minute payment window

**Run `pnpm db:push` first** — `orders` gained a `coupon_id` column. Answer
**"Yes, I want to execute all statements"**; it is one nullable column plus its
foreign key, and no existing data is touched.

### What changed and why

**The coupon was being redeemed at the wrong moment.** Usage was recorded when
the order row was created — before the customer had paid anything — so two
failed Stripe attempts consumed a one-per-customer code without ever charging
you. Card orders now redeem their coupon in `markAsPaid`, which is the single
place a payment is recognised and is shared by the webhook and the success
page. Cash on delivery still redeems at creation, because that order _is_ a
commitment; the courier simply collects later.

Making that possible needed the `coupon_id` column: the order previously had no
idea which coupon produced its discount, since only `coupon_usages` knew — and
that row is exactly what we were trying to stop writing early.

**Cancelling releases the coupon.** A cancelled order returns its stock, and now
its coupon too. Refunds deliberately do not, or a code could be recycled through
repeated returns.

**The order is held for 30 minutes, then releases itself.** It reserves stock
before the Stripe redirect, so an abandoned checkout takes inventory out of
circulation. 30 minutes is Stripe's minimum session expiry, so ours matches it
exactly rather than inventing a second, disagreeing deadline.

> **On showing a countdown on Stripe's page: not possible.** That page is
> Stripe's own hosted UI — we can't render anything into it. The countdown
> lives on our side. Stripe's session does expire on its own schedule, which is
> why the two deadlines are now the same number.

### The checks

- ✅ Start a card checkout, then go to **Admin → Orders → that order**.
  **Expected:** an amber panel — "Waiting for payment — 29:41 left" — that
  ticks down every second.
- ✅ Try to cancel it. **Expected:** the **Cancel Order** button is disabled
  and `Cancelled` is greyed out in the dropdown. The panel explains why.
- ✅ Pay it. **Expected:** the panel disappears, the order is **paid**, and
  only _now_ does the coupon's usage count go up (Admin → Coupons).
- ✅ Start another card checkout with a coupon and **abandon it** — close the
  Stripe tab. Wait out the window, then load Admin → Orders.
  **Expected:** the order is **cancelled** with the note "Payment window
  expired", the stock is back, and the coupon's usage count is unchanged.
- ✅ Check the same coupon is usable again by the same customer.
  **Expected:** yes — the failed attempt did not consume their one use.
- ✅ Place a **cash on delivery** order. **Expected:** no payment window, no
  amber panel, cancellable immediately, and the coupon counts straight
  away.
- ✅ Cancel a COD order that used a coupon. **Expected:** the usage count goes
  back down and the customer can use the code again.
- ✅ Refund a paid order that used a coupon. **Expected:** the usage count
      stays where it is.

### How the expiry actually fires

Two independent routes, because neither alone is reliable:

1. **Stripe's `checkout.session.expired` webhook** — the proper path in
   production. It never fires locally unless `stripe listen` is forwarding.
2. **A lazy sweep** on the storefront stock check, the customer's order list and
   the admin order list, throttled to once a minute per server process, running
   a minute behind the deadline so Stripe's own event gets first go.

So in local development route 2 is what you will see, and it needs a page load
to trigger — the order will not vanish while you stare at an idle screen.

---

## Known limitations (by design, not bugs)

- **Stripe abandonment holds stock.** Stock is reserved when the order is created, before the Stripe redirect. If a customer abandons payment, that stock stays on a `pending` order. Recovery today is manual: cancel the order in Admin and the stock comes back (§6e). A scheduled job to auto-cancel stale pending orders would be the proper fix — say the word and I'll add one.
- **Coupon limit race.** Two checkouts submitted at the exact same instant could both pass the usage-limit check. The stock path is protected by row locks; the coupon counter isn't yet.
- **Billing address still mirrors shipping** (issue #37, P3).
- **Currency is still inconsistent** — orders and Stripe use EGP, the UI renders `$` (issue #17, P1).

---

## If something fails

Tell me which checkbox and what you saw. Useful details: the exact error toast, and for server errors the terminal output from `pnpm dev`.
