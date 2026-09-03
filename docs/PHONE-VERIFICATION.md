# Phone verification — deferred work

**Status** Not built. Specified here because the loyalty programme depends on
it and ships gated behind it.

## Why this exists

The phone number is the only real identity this store holds for a human.
`customers` is keyed on it, several accounts can share one, and — once loyalty
points ship — **a phone number controls a balance of spendable money**.

Nothing verifies it. `customers.is_phone_verified` defaults to `false`,
`Customer.verifyPhone()` in `src/domain/customers/entities/customer.entity.ts`
exists with zero callers, and there is no SMS provider anywhere in the repo.
Whatever number is typed at signup is simply believed.

Everywhere else in the app a wrong number is a bad contact detail. With a shared
balance it is an attack: register with a stranger's number, land in their
customer row, spend their points. Their own accounts see the balance drop and
nothing looks broken, because from the system's point of view nothing is.

## What ships without it

Loyalty ships with the gate in place and the flag unsettable by customers:

- **Earning is ungated.** Points accrue against the phone from day one. No
  friction at signup, and nothing to migrate later.
- **Redemption requires `is_phone_verified`.** Enforced server-side in the
  redeem use case, not in the UI.
- **The bridge is an admin toggle** on the admin customer page. Auditable, and
  unlike a bypass environment variable it cannot be left switched on in
  production by accident.

The toggle is a stopgap for low volume. It does not scale and it puts a support
person in the path of every redemption.

## What needs building

### 1. A provider

None is chosen. The constraint is Egyptian mobile delivery (`+20`), which rules
out several providers that quote global coverage and deliver poorly to EG.
Evaluate on EG deliverability and per-message cost, not on SDK quality.

Cost model matters to the design: verification is required **once per phone
number**, at first redemption — not per signup and not per login — so volume
tracks redeeming customers, not registrations.

### 2. The flow

1. Customer opens a reward and presses redeem.
2. If `is_phone_verified` is false, ask for a code instead of redeeming.
3. Send a 6-digit code to the customer's E.164 number.
4. On success set `customers.is_phone_verified = true` and complete the
   redemption.

Verification is on the **customer**, not the account, so it is done once and
every account on that number is trusted from then on. That follows from the
identity model and is the point of doing it here.

### 3. Storage

A `phone_verifications` table: `customer_id`, a **hash** of the code, `expires_at`,
`attempts`, `consumed_at`. Never store the code in plain text — it is a
short-lived credential.

- Expiry: 10 minutes.
- Attempt cap: 5 per code, then the code dies and a new one must be requested.
- Codes are single-use — `consumed_at` prevents replay.

### 4. Rate limiting

Both directions, through the existing Upstash helpers in
`src/server/utils/rate-limiter.ts`:

- **Send**: per phone and per IP. Each send costs real money, so an unlimited
  send endpoint is a way to spend the store's balance as well as a way to
  harass someone.
- **Verify**: per customer. Six digits is a million combinations; without a cap
  it is brute-forceable.

Note the trap already documented for sign-in: `auth.api.*` bypasses Better
Auth's own `rateLimit.customRules`, so limits on this path must be applied
explicitly, not assumed.

### 5. Enumeration

Sending a code must answer identically whether or not the number belongs to an
existing customer, the same way `sendResetPassword` already does. Otherwise the
endpoint tells anyone which Egyptian mobile numbers hold accounts, and
`+201[0125]XXXXXXXX` is a small enough keyspace to walk.

## Open questions

- **Changing a phone number.** If a customer edits their phone, does the balance
  follow them to the new number, stay with the old customer row, or is the edit
  refused once points exist? Not decided. It needs deciding before customers
  can edit their own number, because each answer is a different way to move a
  balance between humans.
- **Re-verification.** Egyptian numbers get recycled. A number verified two
  years ago may belong to someone else now. Consider re-verifying after a long
  period of inactivity.
- **Merging.** If two customer rows turn out to be one human (two spellings of a
  number that predate server-side normalisation), there is no merge path. The
  ledger makes one possible — sum both, write an adjustment — but it is not
  built.

## Related

- `docs/LOYALTY-POINTS.md` — the programme this gates, and where the identity
  model is set out.
