# P3 + Pass 2 + Performance — Test Plan

Companion to `docs/P0-TEST-PLAN.md` and `docs/P1-TEST-PLAN.md`, covering the
remediation pass implemented on `feat/p3-pass2-remediation`.

**Read this section first.** Most of what changed here cannot be verified by any
test that exists. The automated gates prove the code compiles, lints, and that
the pure logic behaves — they prove nothing about whether a button is visible,
whether an upload succeeds, or whether an email arrives. Those need a person.

---

## What the gates already prove

Run these first. If any is red, stop — nothing below is worth checking.

```bash
./node_modules/.bin/tsc --noEmit     # expect: clean
./node_modules/.bin/eslint           # expect: 0 problems (was 4 warnings)
./node_modules/.bin/vitest run       # expect: all passing
./node_modules/.bin/next build       # expect: static page count at or above 97
```

`pnpm` is not on `PATH` in every shell here; `node_modules/.bin/pnpm` is a shim
forwarding to `corepack pnpm@11`. The durable fix is a `packageManager` field in
`package.json` plus `corepack enable`.

The **static page count is a regression gate**, not trivia. `PERFORMANCE.md`'s
headline result is that collection and product pages prerender; a change that
quietly makes one dynamic costs the thing the whole performance pass bought.
Baseline was 92 before this work and should be ~97 with the five new footer
pages.

Read-only integration suite, needs `DATABASE_URL`:

```bash
./node_modules/.bin/vitest run --config vitest.integration.config.ts
```

---

## 1. Product image upload — the one to check first

**This has been broken for every user, including super_admins, for the entire
life of the feature.** `src/lib/uploadthing.ts` read the admin role from
`session.session.role`; the `session` table has no `role` column, so the value
was always `undefined` and the gate rejected everyone.

| Step                                                          | Expected                                              |
| ------------------------------------------------------------- | ----------------------------------------------------- |
| Sign in as an admin or super_admin                            | —                                                     |
| Go to Admin → Products → New (or edit any product)            | —                                                     |
| Drag an image onto the upload dropzone                        | Upload **succeeds** and the image appears in the list |
| Sign in as a `customer` and call the upload endpoint directly | Rejected with "Admin access required"                 |

**Regression looks like:** "Admin access required" while signed in as an admin.
That is the original bug returning.

Worth confirming the same way for a **category** image, which used the identical
broken gate.

## 2. The cart no longer follows the previous account

| Step                                                                            | Expected                                             |
| ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Sign in as user A, add two products to the cart                                 | Badge shows the items                                |
| Sign out (try all three: account sidebar, the user dialog, and the mobile menu) | Redirects as before                                  |
| Sign in as user B on the same browser                                           | Cart is **empty**                                    |
| As a guest, add items, then sign in as A                                        | Guest items **merge into** A's cart; nothing is lost |

**Regression looks like:** user B briefly seeing an item count appear, then A's
products. The badge starts at 0 by design (an SSR-hydration guard), so watch
what it settles on rather than what it starts at.

## 3. Notifications belong to their owner

Requires two accounts and the browser devtools network tab.

| Step                                                            | Expected                                     |
| --------------------------------------------------------------- | -------------------------------------------- |
| As user A, copy a notification's UUID from the network response | —                                            |
| As user B, call `public.notifications.markAsRead` with A's id   | **No effect.** A's notification stays unread |
| Same for `delete`                                               | **No effect.** A's notification still exists |
| Repeat both with two different **admin** accounts               | Same — no cross-account effect               |

The call returns success either way. That is deliberate: a non-matching row
no-ops silently rather than confirming whether the id exists.

## 4. The palette — needs eyes, not tests

`<html>` now carries `class="dark"`. Nothing automated can see this. Walk the
site in **both** trees.

**Storefront** (every page should be dark, with readable text and visible
buttons):

- Home, a collection, a product page, cart, checkout, checkout success
- **Cart drawer** — open it. `SheetContent` renders here; it previously set a
  background with no paired text colour
- **`/about`, `/returns`, `/shipping`** — see §15. These were genuinely broken
  and should now have headings, bullets and paragraph spacing
- Any dialog: cart stock conflict, sign-in prompts, the coupon chip in checkout

**Admin** (must be unaffected):

- Toggle the admin theme light ↔ dark. Both must work
- Open a dialog and an alert-dialog in each theme — no white-on-white
- Every admin table and chart

**The one known rough edge:** navigate `/admin` → storefront using the sidebar's
"View store" link (a client-side `<Link>`). `next-themes` leaves `class="light"`
on `<html>`, and `StorefrontTheme` corrects it in a layout effect. It should be
imperceptible. If you see a white flash, say so — the fallback is to make that
one link a hard navigation.

## 5. Revenue — expect the number to drop, a lot

**Before you look at the dashboard, know this:** of the 44 orders in the
database when this was written, only **3** had actually collected money. The
dashboard previously counted all 44. Revenue will fall by roughly 93%, and that
fall is the fix working, not a bug.

| Check                                           | Expected                                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Admin → Dashboard                               | Revenue counts only orders whose payment completed, net of refunds                                                |
| Both top metric cards                           | Labelled with their window ("last 30 days"). No "+20.1% from last month" — that string was fabricated and is gone |
| Admin → Analytics                               | Same definition; top products exclude abandoned checkouts                                                         |
| Admin → Customers                               | `totalSpent` excludes cancelled and abandoned orders                                                              |
| Search customers for a term matching one person | Pager reports **1 page**, not the unfiltered total                                                                |
| Search customers for `%`                        | Matches nothing (or literal `%`), not every row                                                                   |

**Cash on delivery is the part to exercise deliberately**, because it is new
behaviour and there were no delivered COD orders to test against:

1. Place a COD order.
2. In the admin, advance it to `delivered`.
3. Check the `payments` row for that order — `payment_status` should now read
   `completed`.
4. The dashboard revenue should rise by that order's total.

**Regression looks like:** a delivered COD order contributing nothing, or a
`pending`/`cancelled` order contributing something.

## 6. Order confirmation emails

**Requires a verified domain in Resend.** Until then, the payload is visible in
the server log — check that instead of the inbox.

| Path         | Expected                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Stripe order | Email quotes the real `VLK-YYYYMMDD-XXXXXX`, real line items, and a formatted multi-line address |
| COD order    | **An email arrives at all.** COD previously sent nothing while the success page promised one     |

**Regression looks like:** an order number that is a 12-character slug of the
Stripe session id, or the literal text "Address will be confirmed separately".

## 7. Customer order detail

Open `/account/orders/<id>` for an order that has been partly returned.

| Check                | Expected                                              |
| -------------------- | ----------------------------------------------------- |
| Header               | The real `VLK-` number, matching what the list showed |
| Each returned line   | "N of M returned · K still yours"                     |
| Summary card         | A "Refunded" line and what you actually paid          |
| Unpaid card order    | Live payment countdown                                |
| Anywhere on the page | The shipping address is rendered                      |

## 8. Variant save

| Step                                                 | Expected                                            |
| ---------------------------------------------------- | --------------------------------------------------- |
| Edit a variant's colour **and** its stock, save once | **One** toast, both saved                           |
| Check `inventory_logs`                               | Exactly one new row, with your user id and a reason |
| Enter an invalid stock value and save                | Nothing is saved — including the colour             |

That last row is the point of the change: stock is applied first, so a rejected
stock value cannot leave the metadata saved behind it.

## 9. Newsletter and auth rate limits

Only active when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are
set; both no-op silently in local development, which is intended.

| Step                                                          | Expected                                               |
| ------------------------------------------------------------- | ------------------------------------------------------ |
| Submit the newsletter form >100 times in a minute from one IP | "Too many requests"                                    |
| Fail sign-in >10 times in 15 minutes                          | Better Auth rejects further attempts                   |
| Request >5 password resets in an hour                         | Throttled, but the response stays identical either way |

That last point is anti-enumeration and must not change: a stranger must not be
able to learn whether an address is registered.

## 10. The five new footer pages

`/size-guide`, `/careers`, `/sustainability`, `/press`, `/blog`. All five were
404s before.

| Check                           | Expected                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Every footer link resolves      | No 404s                                                                           |
| All five in the build output    | Marked `○ (Static)` — none reads the database                                     |
| `/blog`                         | The coming-soon wordmark                                                          |
| `/size-guide` on a narrow phone | The table scrolls **inside its own container**; the page does not scroll sideways |
| Any page                        | No dollar amounts. This store charges EGP                                         |

> **The copy on these pages is placeholder.** It is deliberately structural and
> free of invented facts — no fabricated press quotes, awards, certifications or
> job listings — but it is not your brand's voice. Rewrite it before launch.
> The size-guide measurements are derived from the seed data's `XS`–`XXL`
> variants and should be checked against your actual garments.

## 11. Collections

| Route                      | Expected                                                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/collections/new`         | Genuinely newest first. It previously filtered on `isFeatured`, so a product added yesterday never appeared unless someone pinned it                                  |
| `/collections/accessories` | An honest empty state, **not** the whole catalogue under an "Accessories" heading. Create a category with slug `accessories` and it fills in on the next revalidation |

## 12. Address ownership — found during review, worth verifying

`CreateOrderUseCase` took both address ids from the client and wrote them onto
the order with **no ownership check**. Any signed-in customer could quote
another customer's address id; and because §7 now resolves and renders the
shipping address on the order detail page, they would have been shown that
person's name, street and phone.

Requires two accounts and the network tab.

| Step                                                                   | Expected                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| As user A, create an address and copy its id from the network response | —                                                            |
| As user B, call `public.checkout.createCodOrder` with A's address id   | Rejected: "Selected address is not available"                |
| Same with a random UUID                                                | Same message — identical for "not yours" and "doesn't exist" |
| As user B with B's own address                                         | Order is created normally                                    |

The message is deliberately the same in both failing cases. Distinguishing them
would confirm that an id exists, which is the thing worth not leaking.

## 13. The announcement editor actually saves

It was entirely decorative: uncontrolled `defaultValue` inputs, an "Add" button
with no handler, and a Save button with **no `onClick` at all**. An admin could
type a new message, press Save, and get no error and no change. Only the on/off
switch ever did anything — and the schema stores messages as objects, so the
old textarea was rendering an object into a text field.

| Step                                           | Expected                                                      |
| ---------------------------------------------- | ------------------------------------------------------------- |
| Admin → Settings → Homepage → Announcement Bar | Existing message appears in the textarea                      |
| Change it, press Save Announcement             | Success toast; reload shows the new text                      |
| Press Add, type a second message, Save         | Both messages persist and rotate on the storefront            |
| Remove a message, Save                         | It is gone                                                    |
| Clear every message and Save                   | Refused: "Add at least one message" (the schema requires one) |
| Set a Link URL, Save                           | The first message becomes clickable on the storefront         |

The old "Link Text" field was removed rather than left looking editable — the
schema has no home for it, because a message is its own link text.

## 14. Guest carts, billing addresses, passwords, CMS

See the sections added when those features landed. Each was built in isolation
and reviewed; the manual checks are:

- **Guest cart** — add without signing in, close the tab, reopen, sign in. Items
  survive and merge. Server prices win over anything stale in localStorage.
- **Billing address** — check out with "same as shipping" ticked, then unticked
  with a different address. The order's `billing_address_id` should differ from
  its `shipping_address_id` in the second case.
- **Password policy** — signup rejects `password` and accepts a strong one; the
  strength meter moves as you type. **Check whether the rules are enforced
  server-side**; if the implementation notes say client-only, treat that as a
  known limitation, not a passed test.
- **CMS version history** — edit the hero, then revert it from the history
  panel. The storefront should reflect the revert without waiting out the cache
  TTL.

---

## Not code — your call, outside the repo

These are the last outstanding items and none of them can be done from here.

1. **Neon autosuspend (PERF-06)** — still the largest real-world contributor to
   "the site feels slow". Disable scale-to-zero or raise the suspend delay, and
   confirm the app region matches the database's `eu-central-1`. A cold start
   was measured at 3851 ms against a warm query's 58 ms.
2. **Apply the pending indexes (PERF-15)** — `drizzle/0001_glossy_scourge.sql`.
   Verified idempotent.
3. **Currency backfill (#41)** — `drizzle/0003_backfill_currency.sql`. Rows
   written before the currency work say `USD` though they were charged in EGP.
4. **Trigram search indexes** — `drizzle/0002_search_trgm.sql`. Deliberately
   premature at 36 products; apply when the catalogue reaches the thousands.
5. **Verify a domain in Resend** so the confirmation emails in §6 can actually
   be tested end to end.
6. **Promote the CSP** — `next.config.ts` now sends
   `Content-Security-Policy-Report-Only`. It cannot break anything. Watch the
   browser console over a few days of real traffic, then rename the header to
   `Content-Security-Policy` once the report is quiet.

> **Apply migrations with `pnpm db:push`, never `pnpm db:migrate`.** The
> database was built with `db:push`, so `__drizzle_migrations` is likely empty
> and `migrate` would try to replay the 0000 baseline against tables that
> already exist. Read the diff `db:push` proposes before confirming — it will
> also pick up the corrected `currency` column defaults.

---

## 15. Long-form pages actually have typography

Found in a pre-test audit, and it had been live the whole time.

`@tailwindcss/typography` **is not installed and never has been**, so
`prose dark:prose-invert` was two inert class names. Tailwind's preflight
resets headings to `font-size: inherit` and strips list markers, so every page
relying on `prose` rendered as an undifferentiated wall of text — no heading
hierarchy, no bullets, no paragraph spacing. The five new footer pages copied
the same pattern and shipped with it.

Replaced by a `.prose-val` component class in `globals.css` rather than adding
the plugin.

| Page                                                   | Expected                                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `/about`                                               | "Our Story", "Our Promise", "Join the Community" read as headings, with spaced paragraphs |
| `/returns`                                             | Headings and bulleted lists; the eligibility card grid still opts out via `.not-prose`    |
| `/shipping`                                            | Bulleted policy list with visible markers                                                 |
| `/careers`, `/press`, `/size-guide`, `/sustainability` | Same — these inherited the broken pattern                                                 |

**Regression looks like:** headings the same size as body text, or lists with no
bullets. That is `.prose-val` not being applied.

## 16. Copy now matches what the store charges

The marketing pages contradicted the implementation in two directions at once:
amounts the checkout never charges, denominated in a currency the store does not
use.

| Page                 | Was                                                       | Now                                                                                               |
| -------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `/shipping`          | `$5.99` / `$14.99` / `$24.99+` tiers, free over `$100`    | Free delivery, no minimum — which is what `CreateOrderUseCase` actually does (`shippingCost = 0`) |
| `/shipping`          | "We ship to all 50 US states"                             | "We deliver across Egypt"                                                                         |
| Homepage trust badge | "On orders over $200"                                     | "On every order, no minimum"                                                                      |
| `/faq`               | "$5 gift wrapping at checkout"                            | Removed — checkout has no such option                                                             |
| `/contact`           | `+1 (555) 123-4567`, a New York street address, EST hours | `contactPhone` from settings; the invented address is gone; Egypt hours                           |

**Check no dollar figure appears anywhere customer-facing.** Everything computed
already goes through `formatCurrency`; this was hand-written copy that neither
the currency sweep nor the pricing work ever looked at.

> The address card on `/contact` was **removed, not translated** — inventing a
> plausible Egyptian address would be worse than showing none. Add a real one to
> site settings and it can come back.

## 17. Site settings are read now

`storeName` and the four social URLs were the only settings anything consumed.

| Setting                                      | Where it now shows                                          |
| -------------------------------------------- | ----------------------------------------------------------- |
| `defaultMetaTitle`, `defaultMetaDescription` | Browser tab and search results — check `<head>` on any page |
| `faviconUrl`                                 | Tab icon, when set                                          |
| `contactEmail`, `contactPhone`               | `/contact`                                                  |

Change one in Admin → Settings and confirm it appears within the cache TTL.

> `logoUrl` is still unconsumed. `Navbar` is a client component and cannot read
> `getCachedSiteSettings` directly; threading it through would mean passing it
> from the layout on every render for a value that changes almost never.
> Deliberately left, not missed.

**The build must still report 97/97 static pages.** Root metadata now reads the
database through `unstable_cache`; if that ever turns the route tree dynamic,
revert it rather than trade the prerendering for a settable title.
