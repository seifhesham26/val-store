# Loyalty points — design

**Status** Designed and agreed, **not built**. Deferred deliberately — Phase 2
waits on a margin analysis, and Phase 1 is simply not started.
**Agreed** 2026-09-03

Nothing in this file is a defect and nothing here is half-built: no table, no
column and no code from it exists yet. It is here so the decisions behind it
survive, because most of them are not recoverable from the code — several are
decisions _not_ to do the obvious thing.

A customer earns points on what they actually pay, and spends them on a rewards
page. The balance belongs to the **human**, identified by phone, so several
accounts sharing one number draw down one pot.

## Decisions

|                         |                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Earn rate               | **1 point per 1 EGP** of cash captured — a unit, not a price                        |
| Redemption rate         | **Per reward, deliberately non-linear.** Set in admin, not in code                  |
| Effective return        | Not fixed anywhere. It is whatever reward pricing makes it — see section 5          |
| Rewards page at launch  | **Coming soon.** Points accrue; nothing is redeemable until prices are set          |
| Points vest             | On payment capture: card at payment, COD at delivery                                |
| Points become spendable | **30 days after delivery** — the window the Terms and Returns pages already promise |
| Clawback                | Refund writes a negative entry of `floor(cash returned)`                            |
| Redemption gate         | Requires `customers.is_phone_verified`                                              |
| Reward type             | Store credit for a stated EGP value; may cover **100%** of an order                 |

## Phasing

Reward prices wait on a margin analysis, so the work splits in two. The split is
along a real seam — earning and spending share only the ledger — rather than
being a stub and a follow-up.

**Phase 1 — earn (build now).** Identity and the customer link, the ledger,
earning at capture, locking, clawback, the balance on the account page, and the
rewards page in its "coming soon" state. Nothing is redeemable, so nothing
depends on pricing. Points accrue from the day this ships, which means the
programme later opens to customers who already have balances instead of zeros.

**Phase 2 — spend (after pricing is decided).** Reward rows and their prices,
the redemption flow, the credit applied at checkout (section 6), and the
verification gate becoming load-bearing.

Phase 1 is safe to ship ahead of the economics precisely because a point carries
no promised value until a reward is priced. The one thing Phase 1 must not do is
tell a customer what their points are worth.

## 1. Identity — one pot, by construction

"Spend from one account, it is gone from all three" requires no removal logic.
Three accounts resolve to one `customers` row and the balance lives there.
There is one place, so nothing is ever synchronised.

The failure mode is the alternative — points per account, kept in step — and
today's structure pushes toward it, because an account is linked to a customer
only by string-matching `user.phone`. That string is normalised in the browser
(`SignupForm.tsx:90`) and **never on the server**, so two spellings of one
number are two humans and the pot silently forks.

Therefore:

- **Phone becomes required at signup**, and is normalised to E.164 server-side
  in the `hooks.before` middleware in `src/lib/auth.ts` that already validates
  passwords. Same supported extension point, one more check.
- **`user_profiles.customer_id`** — a real FK to `customers`, set by the signup
  `databaseHooks.user.create.after` hook through `GetOrCreateCustomerUseCase`,
  which already exists and has never had a caller. Identity becomes a join
  rather than a string comparison.
- No unique constraint on `user.phone`. Several accounts per number is the
  feature, not a defect.
- The same hook maintains `customers.total_orders` and `total_spent`, declared
  today and never written.

**Existing accounts** have no phone and no customer. They earn nothing until
they add one. Backfill is a one-off script over accounts that do have a phone;
accounts without one are prompted in the UI, not silently excluded.

## 2. A ledger, not a counter

`customers.loyalty_points` as a bare integer cannot say why a balance is what
it is, cannot be reconciled against orders, and — the real problem — cannot be
safely decremented by two accounts on the same phone at once.

```
loyalty_ledger
  id            uuid pk
  customer_id   uuid -> customers.id  (cascade)
  delta         integer                (+earn, -redeem)
  reason        enum: earn | redeem | refund_clawback | admin_adjust
  order_id      uuid -> orders.id      (set null)  nullable
  redemption_id uuid -> reward_redemptions.id      nullable
  user_id       text -> user.id        (set null)  -- which account acted
  available_at  timestamp nullable     -- null = locked, see section 4
  note          text nullable
  created_at    timestamp
```

- **Balance is derived**: `SUM(delta)`. `customers.loyalty_points` stays as a
  cache of the lifetime total, written in the same transaction.
- **Locking**: every mutation takes `SELECT … FOR UPDATE` on the `customers`
  row first — the discipline `order.repository.ts` already uses for variant
  stock. Two accounts redeeming at the same moment serialise rather than both
  passing the balance check.
- **Idempotency**: unique index on `(customer_id, order_id, reason)`. This is
  load-bearing, not defensive: `markAsPaid` is reached by both the Stripe
  webhook and the checkout success page, and a redelivered webhook must not
  award twice.

## 3. Earning

Hooked to the two places capture already happens, so points and revenue can
never tell different stories:

- **Card** → `DrizzleOrderRepository.markAsPaid()`, already the single place a
  payment is recognised, already idempotent via its `transitioned` flag.
- **COD** → `updateStatus(…, "delivered")`, which already flips the COD payment
  row to `completed`.

Points earned are `floor(cash actually captured)` — net of coupon **and** net of
any points credit. Earning on the list subtotal would let redeemed points earn
points, which compounds. An order fully covered by a credit captures nothing and
therefore earns nothing, closing that loop by construction.

**One point per EGP is a unit, not a cost.** Because every reward prices itself
(section 5), the earn rate never has to change to control margin — the same
balance is worth whatever reward pricing says it is worth. That is what makes it
safe to start earning before the economics are settled: no balance earned today
can be wrong tomorrow, because today's balance carries no promised value. It
also gives customers the simplest possible story, "one point per pound spent",
which survives every future repricing.

## 4. Locking, and why there is no cron

Points are written at capture but are not spendable until 30 days after
delivery. Rather than a scheduled job that flips rows — which drifts, and fails
silently when it stops running — each row carries `available_at`:

- **Spendable balance** = `SUM(delta) WHERE available_at IS NOT NULL AND
available_at <= now()`. A filtered sum evaluated at read time. Nothing to run,
  nothing to drift.
- **COD**: earn happens at delivery, so `available_at = delivered_at + 30d` is
  known immediately.
- **Card**: earn happens at capture, when delivery has not happened.
  `available_at` starts `NULL` (locked) and is filled when the order reaches
  `delivered`.
- Entries with no order — `admin_adjust` — are available immediately.

**Known consequence:** an order paid but never marked delivered keeps its points
locked indefinitely. That is correct — no delivery means no return window can
have elapsed — but it makes admin discipline load-bearing, so the admin customer
page shows _locked points awaiting delivery_.

Clawback: a refund inside the window writes a negative entry that nets against a
locked row the customer could never have spent. No debt, no negative balance —
which is the whole reason for locking, and it closes the earn → redeem → refund
loop for every return the store actually promises.

**It does not close it absolutely.** `OrderEntity.canRefund()` has no time
limit — it tests captured payment, not age — so an admin can refund an order
long after its points unlocked and were spent. That case is rare and
admin-initiated rather than customer-driven, so it is not worth a second
mechanism: the clawback is written and **the balance is allowed to go
negative**, which is the honest record. The customer works the debt off on their
next order. The admin refund UI should say so before confirming.

Clawback amount is `floor(cash returned by this refund)` — that is
`OrderEntity.refundedAmount()`, which is already scaled by `paidFraction()` for
coupon orders. Points were earned on cash, so they are returned on cash, and the
two use one number rather than two parallel calculations that can drift.

## 5. Rewards

```
rewards
  id, name, description, image_url,
  point_cost    integer,
  value_egp     decimal(10,2),
  product_id    uuid nullable   -- for DISPLAY only, see below
  is_active     boolean,
  display_order integer

reward_redemptions
  id, customer_id, reward_id,
  points_spent     integer,
  value_egp        decimal(10,2),
  status           enum: available | applied | void,
  user_id          text          -- which account redeemed
  applied_order_id uuid nullable
  created_at, updated_at
```

Redeeming deducts points (one `redeem` ledger row) and creates a redemption
whose `status = available`. **The redemption is the credit** — no separate
credits table.

### Pricing is per reward, and deliberately not linear

`point_cost` and `value_egp` are independent columns. Nothing in the code
computes one from the other, and there is no global exchange rate constant to
find and change. Each reward is priced on its own.

The intent is that **small rewards buy at a worse rate than large ones**, so the
programme pulls toward the large reward instead of being drained in 10 EGP
slices:

| Reward         | Illustrative cost | Effective return |                                        |
| -------------- | ----------------- | ---------------- | -------------------------------------- |
| 10 EGP off     | 200 pts           | 5%               | worst rate — a taste, not a habit      |
| 100 EGP off    | 1,500 pts         | 6.7%             |                                        |
| 750 EGP hoodie | 7,500 pts         | 10%              | best rate — the thing worth saving for |

**Those numbers are illustrative, not decided.** Real prices wait on a margin
analysis. They live in `rewards` rows set through the admin, so revising the
entire economics is data entry, not a deploy — which is the point of keeping
them out of code.

Two consequences of pricing this way, both intended:

- The programme's cost is bounded by what you price, not by what customers earn.
  A balance is only worth something once a reward exists to spend it on.
- Because rates differ per reward, the page must **show the rate**, not just the
  cost. A customer who works out that the small rewards are poor value and feels
  tricked is worse than one who never redeems.

### Launching as "coming soon"

The rewards page ships with **no active rewards**. It shows the customer their
balance, what they have earned and what is still locked, and says rewards are
coming — which is honest, and it means points are already accruing when pricing
is settled, so the programme opens with customers who have balances rather than
zeros.

This is a real launch state, not a stub: `rewards.is_active` already gates the
catalogue, so "coming soon" is the empty case of the normal page rather than a
separate thing to build and later delete. Redemption stays behind both this and
the verification gate (section 7).

`product_id` is presentational: the reward card shows the hoodie's image and
name so the page sells the reward, but what is issued is credit for `value_egp`.
This avoids stock reservation, out-of-stock-after-redemption rules and variant
choice ("which size hoodie?") for v1. The accepted trade-off: a customer may
redeem the hoodie reward and spend it on socks.

## 6. Checkout — Phase 2

The column is added in Phase 1 so there is one migration rather than two; the
logic that writes to it is Phase 2.

`orders.points_credit_amount decimal(10,2) default 0` — its **own** line,
separate from `discount_amount`, so a refund returns money to the card and
points to the pot without the two contaminating each other.

Order of application: subtotal → coupon discount → points credit → total,
floored at zero. A credit may cover **100%** of the order.

**A fully covered order has nothing to charge.** It cannot create a Stripe
Checkout Session, so it commits directly as a paid order with a zero-amount
payment row, on the COD-style path. Payment-gateway work is deferred, so this is
specified but flagged for revisiting once the gateway is chosen.

## 7. The verification gate

Earning is ungated. **Redemption requires `customers.is_phone_verified`.**

Nothing can set that flag today — `Customer.verifyPhone()` exists with zero
callers and there is no SMS provider in the repo — so redemption would ship
dead. The bridge is an **admin toggle** on the customer page: auditable, and
unlike a bypass environment variable it cannot be forgotten in production.

The real mechanism is specified separately in `docs/PHONE-VERIFICATION.md`.

## 8. Testing

Following the `variant-stock-registry.ts` pattern — logic in plain modules,
tested without a database:

- `loyalty-math.ts` — earn from captured cash, clawback scaling, redemption
  eligibility, spendable vs locked. Unit tested.
- Ledger idempotency and the `FOR UPDATE` path: integration, including two
  accounts on one phone redeeming simultaneously.
- Note: `pnpm test:integration` is currently 20 of 41 red for reasons predating
  this work. Those need fixing, or these tests land in a suite nobody trusts.

## 9. Out of scope

True product rewards with stock reservation. Points expiry. Tiers. Referral
points. Transferring points between customers.

## 10. Undecided

Recorded rather than guessed at, because each needs a business answer:

- **Reward prices.** The reason for phasing. Pending margin analysis.
- **Changing a phone number.** If a customer edits their phone once points
  exist, does the balance follow them, stay with the old customer row, or is the
  edit refused? Each answer is a different way to move money between humans.
  Must be settled before customers can edit their own number — see
  `docs/PHONE-VERIFICATION.md`.
- **Whether a balance should ever expire.** Unexpiring points are an open
  liability that grows forever. Expiry is out of scope above, but the ledger's
  `created_at` makes it addable later without restructuring anything.
