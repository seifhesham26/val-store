# Post-launch tasks

Work deliberately deferred past the production cutover, and the checks that
belong at the cutover itself.

Nothing here is a defect. Every item is either a decision that was taken
knowingly, or work whose value only arrives at a scale the store has not
reached yet. Each one says **when** it starts mattering, so this file can be
read cold and triaged rather than treated as a backlog to grind through.

Written 2026-09-03, after the security hardening pass and the catalogue
reconciliation; extended 2026-09-04 with the cart entity and coupon hold. The
defect catalogue is `docs/ISSUES.md`; this is the part that is not defects.

---

## At the cutover

### 1. Set `UPSTASH_*` in the production environment

`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

**Do not skip this one.** Every rate limiter in the app no-ops _silently_ when
those two variables are absent — that is deliberate, so local development works
without Redis, but it means a production deployment without them has:

- no throttle on sign-in, on either the per-IP or the per-identifier budget
  (`src/server/routers/auth.ts`)
- no throttle on password reset, newsletter subscribe, product search, review
  submission, or the CSP report collector

There is no warning and no error. The only symptom is that a brute-force
attempt succeeds where it should have been blocked. `checkRateLimit` returns
`{ allowed: true, remaining: Infinity }` and everything looks healthy.

Verify after deploy by hitting `/login` with wrong credentials more than ten
times in fifteen minutes and confirming the eleventh is refused.

### 2. Confirm `NODE_ENV` is not carried over

Do **not** set `NODE_ENV` in Vercel — the platform sets it. It was removed from
the local `.env` because a copied file reaching a deployment would turn on tRPC
stack traces for the public and disable Next's production hardening.

### 3. Verify the currency defaults on the real database

The baseline migration and both snapshots were corrected on 2026-09-03 —
`orders`, `payments` and `site_settings` create their `currency` column as
`DEFAULT 'EGP'`. Confirm it on the rebuilt database rather than trusting the
files:

```sql
SELECT table_name, column_default FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'currency';
```

All three must read `'EGP'`. If any says `'USD'`, the database was built from a
stale migration.

### 4. Click through sign-in, by phone and by email

The one change from the security pass a build cannot validate. Sign-in now goes
through a tRPC mutation whose session arrives as a `Set-Cookie`, and the form
does a full page load rather than `router.push` — because the Better Auth
client's session store would otherwise stay signed-out until a real navigation.

Check both paths, and check that a wrong password and an unknown account give
the _same_ message. That identical message is anti-enumeration, not an
oversight.

### 5. Apply `drizzle/0005_cart_entity.sql`

**This one is destructive and `pnpm db:migrate` will not do it for you.**

`carts` was built with `db:push` and existed in no migration file until this
one. `meta/_journal.json` still lists only `0000` and `0001`, so `0005` is
unjournalled exactly like `0002`, `0003` and `0004` — the migrate command skips
it silently.

Apply it by pasting the file into the Neon SQL editor or psql. **Prefer that
over `db:push`.** Push infers the schema change but cannot infer the backfill,
so it would drop `cart_items.user_id` with the `carts` rows unbuilt and empty
every customer's cart. The file does it in the order that survives: create
`carts`, add a nullable `cart_id`, backfill both, make it `NOT NULL`, and only
then drop `user_id`.

It is wrapped in one transaction and every step is guarded, so it is safe to
re-run and safe against a database `db:push` has already migrated. Step 5 of
the file fails loudly rather than deleting rows if any item cannot be traced to
an owner — that is deliberate.

Both halves were verified against the real database on 2026-09-04 without
persisting anything: the file was executed with its `COMMIT` swapped for
`ROLLBACK`, and the backfill statements — which that run skips, because the dev
database no longer has `cart_items.user_id` for the guard to match — were run
separately against a scratch schema holding the old shape. Four items across
three users produced three carts, zero orphans, and zero items on the wrong
owner's cart.

---

## Pre-launch smoke test

Carried forward from `docs/P3-TEST-PLAN.md`, which was deleted on 2026-09-03:
it was written against a finished branch and several of its sections described
code that has since been replaced, which at launch is worse than having no
checklist at all. What survives is the part that is still true — the checks a
person has to make because no test in the suite can.

Run the gates first. If any is red, stop; nothing below is worth checking.

```bash
pnpm type-check   # clean
pnpm lint         # 0 errors, 0 warnings
pnpm test         # 483 passing, 38 files
pnpm build        # 98 static pages
```

### 1. Sign in — both paths, and the failure message

The highest-risk change in recent work. Sign-in now goes through one tRPC
mutation whose session arrives as a `Set-Cookie`, and the form does a full page
load rather than `router.push`.

| Step                                               | Expected                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| Sign in with an email address                      | Lands signed in; navbar, cart badge and wishlist all reflect the account |
| Sign in with the phone number on that same account | Identical result                                                         |
| Wrong password                                     | "Invalid credentials. Please check and try again."                       |
| An email or phone with **no account**              | **Exactly the same message**                                             |

That last row is the point: identical messages are anti-enumeration, not
laziness. Two different messages is a regression.

### 2. Product and category image upload

Broken for every user including super_admins for the whole life of the feature
— the gate read a `role` off the `session` table, which has no such column, so
it rejected everyone.

| Step                                                               | Expected                                     |
| ------------------------------------------------------------------ | -------------------------------------------- |
| As an admin: Admin → Products → New, drop an image on the dropzone | Upload succeeds, image appears               |
| Same for a **category** image                                      | Succeeds — it used the identical broken gate |
| As a `customer`, call the upload endpoint directly                 | "Admin access required"                      |

**Regression looks like:** "Admin access required" while signed in as an admin.

### 3. The cart does not follow the previous account

| Step                                                                | Expected                            |
| ------------------------------------------------------------------- | ----------------------------------- |
| Sign in as A, add two products                                      | Badge shows them                    |
| Sign out — try all three: account sidebar, user dialog, mobile menu | Redirects                           |
| Sign in as B on the same browser                                    | Cart is **empty**                   |
| As a guest add items, then sign in as A                             | Guest items **merge**; nothing lost |

### 4. Address ownership

| Step                                                            | Expected                            |
| --------------------------------------------------------------- | ----------------------------------- |
| As A, create an address, copy its id from the network tab       | —                                   |
| As B, call `public.checkout.createCodOrder` with A's address id | "Selected address is not available" |
| Same with a random UUID                                         | **Identical** message               |
| As B with B's own address                                       | Order created normally              |

### 5. A real order, end to end

Both payment paths, because they diverge after the order row is written.

| Step                              | Expected                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| Cash on delivery checkout         | Order created; cart cleared; confirmation email quotes a real `VLK-YYYYMMDD-XXXXXX` number    |
| Stripe checkout, completed        | Order becomes `paid`; cart cleared; email quotes the **same** number, not a Stripe session id |
| Stripe checkout, abandoned        | Order stays `pending`, then cancels itself and **returns the stock**                          |
| Add more than the available stock | Refused before the order is written                                                           |

### 6. The read-only `worker` tier

New on 2026-09-03, so nothing about it is proven by use.

| Step                                                               | Expected                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Promote an account to `worker` (set `user_profiles.role` directly) | —                                                              |
| Open `/admin` as that account                                      | Every screen loads; amber "Read-only access" banner at the top |
| Attempt any save, create or delete                                 | Refused: "Your account has read-only access to the admin area" |
| Open the notification bell and dismiss one                         | **Works** — notifications are scoped to the user, deliberately |
| Same screens as an `admin`                                         | No banner; everything saves                                    |

### 7. The palette, in both themes

Needs eyes. The body no longer carries colour literals, so anything Radix
portals inherits its colour from the palette rather than from a hardcoded
white.

| Step                                                                 | Expected                                               |
| -------------------------------------------------------------------- | ------------------------------------------------------ |
| Storefront: open the signup birthday date-picker                     | Dark popover, readable dates                           |
| Admin (light): open any dialog, dropdown, select and the date-picker | Dark text on light surfaces — **never white on white** |
| Admin → toggle to dark → same surfaces                               | Readable                                               |
| Navigate admin → storefront → admin                                  | Palette follows correctly each way                     |

**Regression looks like:** a popover that appears blank until you select text.

### 8. Rate limits are actually on

Only meaningful once `UPSTASH_*` is set — see the cutover section above.

| Step                                          | Expected                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| Fail sign-in more than 10 times in 15 minutes | Refused with "Too many attempts"                                       |
| Request a password reset 4+ times in an hour  | Silently throttled; the response never says whether the address exists |
| Submit the newsletter form repeatedly         | Throttled                                                              |

### 9. Email

Nothing here is provable until a domain is verified in Resend.

| Step                                                  | Expected                                                       |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| Place a COD order                                     | Confirmation arrives, real order number, real shipping address |
| Complete a Stripe order                               | Same                                                           |
| Request a password reset for a **registered** address | Email arrives                                                  |
| Request one for an **unregistered** address           | Same on-screen response, no email                              |

### 10. The coupon survives a reload

**The single most important check in this list**, because it is the whole
premise of the coupon hold and nothing in the suite covers it — there is no DOM
testing library in this repo, so `CouponField` and its wiring to the router
have no automated test at all. Everything beneath the UI is well covered; the
last inch is not.

Signed in, with something in the cart:

1. Apply a valid code. A badge with the code appears. **There must be no
   discount amount and no countdown** — the cart shows the code, checkout
   prices it, and the 15-minute re-check window is internal.
2. **Reload the page. The badge is still there.** This is the feature.
3. Sign out, sign back in. Still there.
4. Open the cart drawer and the `/cart` page. Both show it, and a code applied
   in one appears in the other.
5. Apply a nonsense code. The error renders _inline under the input_, not as a
   toast — the customer is looking at the field.
6. Remove the coupon. The badge goes.
7. Empty the cart with **Clear Cart**. The coupon goes with it.
8. Re-apply a code, then remove items one at a time until the cart is empty.
   The coupon **stays** — see the limitation below; this asymmetry is
   deliberate and is the difference between an explicit clear and an implicit
   one.
9. Go to `/checkout`. The same field is there, showing the same code, and the
   summary prices the discount.

---

## Deferred work, and when it starts mattering

### `0002_search_trgm.sql` — trigram indexes for search

**When:** the catalogue reaches roughly a thousand products, or admin customer
search feels slow on a warm database. **Not before** — see step 1.

#### What the problem is

Product search and admin customer search both run `ILIKE '%term%'`. That
leading `%` means "match anywhere in the text", and a normal btree index cannot
serve it: an index is sorted like a phone book, so it answers "starts with H"
instantly and "contains oodi" not at all. Postgres has no option but to read
every row and test each one — a sequential scan.

`pg_trgm` is a standard Postgres extension that splits text into overlapping
three-character chunks — `hoodie` becomes `hoo`, `ood`, `odi`, `die` — and
indexes those. A GIN index over the trigrams turns "contains" into an index
lookup.

Two consequences worth knowing before you rely on it:

- **Search terms shorter than three characters cannot use the index.** There is
  no trigram to look up, so a two-letter search still scans. That is inherent,
  not a misconfiguration.
- **The index costs writes.** Every product save and every customer signup
  updates it. That is the trade, and it is why this is not applied by default.

#### Step 1 — confirm you actually need it yet

Applying this early is a small net loss. Measure rather than assume:

```sql
SELECT count(*) FROM products;
SELECT count(*) FROM "user";
```

Under a few hundred rows, stop here — a sequential scan over 36 products is
genuinely faster than consulting an index and then fetching the rows.

Then time the real query shape:

```sql
EXPLAIN ANALYZE
SELECT id, name FROM products
WHERE name ILIKE '%hood%' OR description ILIKE '%hood%';
```

Read `Execution Time` at the bottom. If it is single-digit milliseconds, there
is nothing here worth buying. Note `Seq Scan on products` in the plan — that is
the thing this change removes.

#### Step 2 — install the extension, as the database owner

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

**Run this in the Neon SQL editor, signed in as the project owner.** The
application's connection role usually lacks `CREATE EXTENSION`, and this is the
statement that will fail if it does. Confirm it took:

```sql
SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
```

One row means you can continue. No rows means the role lacked the privilege —
nothing else in this section will work, and nothing has been changed.

#### Step 3 — create the indexes, without locking the store

`drizzle/0002_search_trgm.sql` uses plain `CREATE INDEX`, which is correct for
an empty or offline database and **wrong for a live one**: it takes an
`ACCESS EXCLUSIVE` lock and blocks every write to that table until it finishes.
On a store taking orders that is an outage.

On a live database use `CONCURRENTLY` instead. It cannot run inside a
transaction, so send these **one statement at a time**, not as a single pasted
block:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_description_trgm
  ON products USING gin (description gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_name_trgm
  ON "user" USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_email_trgm
  ON "user" USING gin (email gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_phone_trgm
  ON customers USING gin (phone gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_preferred_name_trgm
  ON customers USING gin (preferred_name gin_trgm_ops);
```

`user` must stay double-quoted — it is a reserved word.

**A `CONCURRENTLY` build can fail and leave an invalid index behind**, which
keeps costing writes while serving no reads. Always check afterwards:

```sql
SELECT c.relname, i.indisvalid
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relname LIKE '%_trgm';
```

Every row must show `indisvalid = true`. Drop and rebuild any that says false:

```sql
DROP INDEX CONCURRENTLY idx_products_name_trgm;
```

#### Step 4 — verify Postgres actually uses them

Creating an index does not oblige the planner to use it. Re-run the plan from
step 1:

```sql
EXPLAIN ANALYZE
SELECT id, name FROM products
WHERE name ILIKE '%hood%' OR description ILIKE '%hood%';
```

You want `Bitmap Index Scan on idx_products_name_trgm` in the plan and a lower
`Execution Time`. If it still says `Seq Scan`, the planner has decided the scan
is cheaper — which on a small table is the planner being right. Refresh its
statistics and try again before concluding anything:

```sql
ANALYZE products;
```

#### Step 5 — record it

The journal (`drizzle/meta/_journal.json`) does not list `0002`, deliberately:
`CREATE EXTENSION` failing inside `pnpm db:migrate` would abort an entire
deploy. So nothing in the repo will know you ran this. Note the date in this
file, or the next person will re-derive it from `pg_indexes`.

#### Rolling back

Safe and complete — the indexes are pure optimisation, nothing reads them
directly and no application code refers to them by name:

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_products_name_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_products_description_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_user_name_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_user_email_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_customers_phone_trgm;
DROP INDEX CONCURRENTLY IF EXISTS idx_customers_preferred_name_trgm;
```

Leave the extension installed; it costs nothing on its own.

### `public.cart.applyCoupon` has no rate limit

An authenticated customer can enumerate coupon codes: the procedure answers
"Invalid coupon code" for a code that does not exist and a specific message for
one that does, so the two are distinguishable, and nothing throttles the
attempts.

This is consistent with the rest of the cart router, which has no limiter
anywhere, and it is gated behind sign-in — an attacker needs an account. It is
called out because this codebase takes enumeration seriously everywhere else:
`public.auth.signIn` returns one message for every failure and carries two
Upstash limits, and password reset answers identically for registered and
unregistered addresses.

**When it starts mattering:** when coupon codes become guessable or valuable —
a public campaign with short codes, or codes worth more than the cost of a
throwaway account. Reuse the existing rate-limiter pattern, keyed per user
rather than per IP.

### Promote the CSP `script-src` directive

**When:** after a few days of real traffic, once `/api/csp-report` has been
quiet.

Four directives are already **enforced** (`object-src`, `base-uri`,
`frame-ancestors`, `form-action`). `script-src` and `style-src` remain
report-only because they still carry `'unsafe-inline'` and `'unsafe-eval'`,
which exist because Next injects inline bootstrap scripts. Removing them needs
Next's nonce support wired through the root layout — that is the actual task,
and it is worth doing only once the reports show what else would break.

Read the collected violations in the server log; they are logged as
`{"event":"csp-violation",...}`.

### Dependencies on unsupported lines

**When:** before the next advisory lands on either. Neither has one today —
`pnpm audit` is clean in both scopes.

- **`eslint` 9.x is entirely end-of-life.** Only 10.x is supported.
  `eslint-config-next` already permits `>=9.0.0`, so the upgrade is available;
  it is a major with flat-config changes. Dev-only.
- **`recharts` 2.x is deprecated** in favour of 3.x, and drives the admin
  charts. A real migration with a published guide.

**Re-run the audit into a file**, never through anything with a display limit:

```bash
pnpm audit --prod --json > audit.json
```

Reading it through a truncating viewer is how 65 of 69 advisories went
unnoticed once already — including two criticals in the auth library. That is
recorded as S1 in `docs/ISSUES.md`.

### Neon autosuspend

**When:** if "the site feels slow" is still reported after launch.

The database suspends when idle and takes several seconds to wake on the first
request. This is the most likely remaining cause of a slow first page load, and
it is infrastructure configuration rather than anything in the code. See
`docs/PERFORMANCE.md`.

---

## Known limitations — decisions, not bugs

These were chosen. They are written down so they are not rediscovered as
defects later.

### A `worker` can read everything

`worker` is a read-only tier: it opens every admin screen and can change
nothing. Read-only constrains **writes, not scope** — a worker still reads
every customer's address and order history.

Splitting catalogue work from customer data is a larger change: it needs a
per-router permission model rather than two tiers. Take it when you actually
have someone who should manage products without seeing customers.

### Write controls are still rendered for a worker

The server rejects them (`adminWriteProcedure`) and `AdminReadOnlyBanner`
explains why, but individual buttons across the 14 admin screens are not
disabled per control. A worker can click Save and get an error rather than
seeing a greyed-out button.

`useAdminWriteAccess()` exists for exactly this and is already wired to the
banner — the remaining work is applying it at each call site.

### `getClientIp` trusts the first `x-forwarded-for` hop

Correct on Vercel, which sets that header itself. On any host that does not,
the header is attacker-controlled and every per-IP rate limit becomes advisory.
**If this ever leaves Vercel, that function is the first thing to revisit.**

### Sign-up does not require email verification

`requireEmailVerification: false`. An account can be created against an address
the person does not control. Deliberate — it is what makes the storefront
usable without a mail round trip — and it is why a review's "verified purchase"
badge is earned from an order rather than from an email.

### Two product decisions still open

- The contact form is `ContactFormPlaceholder.tsx` and submits nowhere.
- ~~The phone-keyed `customers` table is written by the signup hook and read by
  nothing.~~ **Decided 2026-09-03: the phone-identity model is wanted.** A
  phone is one human, several accounts may share it, and a loyalty balance
  hangs off it. The design is `docs/LOYALTY-POINTS.md`; the verification it
  depends on is `docs/PHONE-VERIFICATION.md`. Neither is built. Until Phase 1
  of that ships, the `customers` table and `GetOrCreateCustomerUseCase` are
  still written-but-never-read, so do not treat their existence as evidence the
  model is live.

### The currency backfill was deliberately not run

`drizzle/0003_backfill_currency.sql` still contains `UPDATE` statements that
were **not** applied. The 25 `USD` rows in `orders` are seed fixtures with no
`payments` row — nothing was ever charged on them — so rewriting them would
assert a charge that never happened. Only the `SET DEFAULT` half was applied.

If the database is rebuilt from scratch, skip the file entirely; the corrected
baseline already does the right thing.

### Checkout shows a coupon badge with no discount and no reason

If the cart drops below the coupon's minimum, the badge stays (correctly — the
coupon is alive, the cart is merely ineligible), but `CheckoutOrderSummary`
prices it at zero and renders no discount row, with nothing saying why. The
customer sees an applied code, a full-price total, and no explanation until
Place Order fails.

`useHeldCouponDiscount` already has the validator's message in hand. Surfacing
it under the summary — "`FLASH` needs a EGP 500 minimum" — turns a dead end
into something actionable. Left undone because it is presentation, not
correctness: the charge is right either way.

### Clearing the cart drops the coupon; emptying it by hand does not

`clearCart` nulls the coupon columns, so the **Clear Cart** button deletes a
held code. Removing the last item one at a time keeps it, because an empty cart
is treated as "no evidence about the coupon" rather than as grounds to drop it.

Two routes to the same state with two outcomes. It is defensible — an explicit
clear is explicit intent, and the implicit path is the one where silently
deleting a customer's code would be wrong — but it is undocumented in the UI,
so a customer could reasonably be surprised either way.

### `clearAppliedCoupon` clears whatever is held, not what was judged

The re-check reads the held coupon, decides, and then clears — without
asserting that the coupon it is clearing is still the one it judged. If the
customer applies a different code in that window, the verdict on the old code
deletes the new one. `applyCoupon` returns success and the cart holds nothing.

Narrow and non-corrupting: nothing is charged wrongly and re-applying fixes it.
The airtight version gives `clearAppliedCoupon` and `touchCouponCheckedAt` an
expected `couponId` and adds `eq(carts.couponId, expected)` to the where
clause. `touchCouponCheckedAt` already carries half of this — an
`isNotNull(carts.couponId)` guard — because without it a concurrent
`removeCoupon` could leave `coupon_checked_at` set on a cart with no coupon.

### `AppliedCoupon` carries two fields nobody reads

`couponId` and `appliedAt` on the DTO have no consumers — every caller uses
`code` (checkout, `CouponField`) or `checkedAt` (the freshness window). Left in
place because the `couponId` is what the race fix above would need, and
removing it now only to add it back is churn.
