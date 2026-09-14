# Inventory adjustment request and review

## Status and authority

This design records the brand-owner decisions approved after
`docs/PRELAUNCH-HANDOFF.md`. Where it conflicts with older documentation, this
document is newer and controls this phase.

The design is approved but unbuilt. The existing customer-data access and audit
foundation is complete and is not part of this work.

## Goal

Let workers report damaged, missing, or extra physical stock without giving them
permission to change inventory. Admins and super admins review every proposed
stock change, while low-stock inspections protect the last units from being sold
before a worker confirms that the physical stock is sound.

The implementation must remain small: reuse the existing inventory page,
notification system, role tiers, inventory logs, stock-changing transactions,
and catalogue stock refresh rather than creating assignments, messaging, or a
general workflow engine.

## Existing foundation

The following behavior already exists and remains authoritative:

- order creation locks variants, decrements stock, and writes `sale` inventory
  logs in the order transaction;
- cancellations and returns restore stock and write inventory logs;
- `AdjustStockUseCase` performs an absolute admin adjustment under a variant row
  lock and records the movement;
- product and variant creation may establish opening stock;
- inventory reads are available to worker, admin, and super-admin roles, while
  managed writes use the admin/super-admin write tier.

This phase does not replace those paths. It adds a worker proposal path, makes
availability consistent, and hardens the stock-changing paths where a repeated
or concurrent action could credit stock twice.

## Concepts

### Low-stock inspection

A low-stock inspection answers one question: has a worker physically checked
the remaining units in this low-stock cycle?

It records:

- the variant id and immutable product, SKU, size, and color snapshots;
- the stock level that triggered the inspection;
- `pending`, `all_fine`, or `flaw_reported` state;
- the worker id and name snapshot that completed it;
- creation and completion timestamps;
- the linked adjustment request when a flaw is reported.

An inspection is not an adjustment request. Reporting **all fine** changes no
stock and therefore completes immediately without admin approval.

### Adjustment request

An adjustment request records a proposed change to inventory. It contains:

- the variant id and immutable product, SKU, size, and color snapshots;
- requester id and name snapshot;
- `damaged`, `missing`, or `extra` category;
- a positive requested quantity, with direction derived from the category;
- a required concrete explanation;
- stock at request time;
- `pending`, `approved`, or `rejected` status;
- approved quantity, reviewer id and name snapshot, required decision
  explanation when corrected or rejected, and review time;
- the inventory-log id produced by an approval;
- an optional link to the low-stock inspection that produced the request.

The original request is immutable. A worker cannot edit or withdraw it; a
mistake is corrected with a new request so the history remains intelligible.
Multiple pending requests may exist for the same variant because they may
describe separate findings. The reviewer investigates them together and may
approve both, correct one, or reject a duplicate.

## Roles and authorization

### Worker

- May read inventory, low-stock inspections, inventory history, and every
  adjustment request and outcome.
- May complete a pending inspection as **all fine**.
- May submit damaged, missing, or extra requests.
- Cannot approve, reject, directly adjust stock, or alter another record.
- Sees **Request adjustment** instead of a direct stock-edit control.

### Admin and super admin

- Retain the existing direct-adjustment capability.
- May read all inspections and adjustment requests.
- May approve the requested quantity, approve a corrected quantity, or reject.
- Must explain a corrected approval or rejection.

Request creation is worker-only, so self-approval is not a separate policy or
schema concern. Server procedures enforce every role rule; hidden or disabled
controls are only a usability layer.

## Low-stock cycle and protection

An inspection is created when recorded stock enters the range **1 through 20**
without an inspection already belonging to that low-stock cycle. This includes
crossing down from above 20 and being restocked directly into the range. Zero
stock creates no inspection.

The cycle ends when stock reaches zero or later rises above 20. A later entry
into 1 through 20 starts a new inspection. Completing an inspection once is
enough for that cycle; selling from 20 to zero must not repeatedly create work.

While an inspection is pending, the final 10 recorded units are protected:

```text
sellable stock = max(recorded stock - 10, 0)
```

Examples:

- recorded stock 19 exposes 9 units for sale;
- recorded stock 11 exposes 1 unit;
- recorded stock 10 exposes 0 units.

A green **checked—all fine** completion releases the protection immediately.
The remaining recorded units may then sell below 10 down to zero.

A damaged or missing report quarantines the whole variant immediately, even if
recorded stock is above 10, because the trusted sellable count is unknown until
review. An extra-stock request does not quarantine already trusted stock; the
reported extra units simply remain unavailable until approval adds them.

Approving or rejecting a flaw request resolves its quarantine. Approval treats
the worker's checked remainder as trusted stock. Rejection records the admin's
reason and restores normal availability; an admin who still needs another count
leaves the request pending rather than rejecting it.

Manual availability remains separate. No sale, return, adjustment, inspection,
or request may automatically turn a manually unavailable variant back on.

## Customer-facing availability

One server-owned calculation determines sellable stock:

1. manually unavailable, zero recorded stock, or flaw quarantine: zero;
2. pending low-stock inspection: recorded stock minus the protected 10;
3. otherwise: recorded stock.

The same result drives product cards, collection scrolling and live refresh,
product detail, variant selection, the quantity `+` control, cart validation,
and checkout. Client checks provide immediate feedback, but the locked checkout
transaction is authoritative.

When protection or quarantine makes a variant unavailable while recorded units
remain, customers see:

> **Temporarily unavailable**  
> We're confirming availability. Check back soon.

The storefront must not call this **sold out**, because stock may remain, and
must not claim **restocking soon** unless a real incoming restock is recorded.
Internal screens show the precise inspection, flaw, and review states.

## Request and review flow

### Worker submission

1. The worker selects a variant, category, positive quantity, and explanation.
2. The server validates the worker role and current variant.
3. It stores the immutable request and current stock snapshot.
4. Damaged or missing requests establish quarantine in the same transaction.
5. The existing in-app notification system alerts admins and super admins.
6. Pending counts refresh on the Inventory Requests tab and beside Inventory in
   the staff sidebar.

### Admin decision

1. The review screen shows the original request, request-time stock, current
   stock, other pending requests for the variant, and the projected result.
2. The reviewer chooses approve, corrected approve, or reject.
3. Approval locks the variant and reloads current stock inside one transaction.
4. It applies a signed difference to current stock: damaged and missing subtract;
   extra adds.
5. A subtraction that would make stock negative is refused. The reviewer must
   correct the approved quantity or reject the request.
6. The same transaction writes the existing inventory log, links it to the
   request, records the reviewer decision, resolves quarantine where applicable,
   and reconciles the inspection cycle.
7. Rejection changes no stock but records the reviewer, reason, and time and
   resolves quarantine where applicable.

Every decision is compare-and-set from `pending`; double clicks and repeated
requests cannot decide or apply the same request twice.

## Orders discovered during a flaw

A damaged or missing report may arrive after customers have ordered the variant.
While its quarantine is active, staff order views identify unshipped orders that
contain the variant, and the server refuses to transition them to shipped.

Staff investigate the physical units, then either use a verified replacement or
cancel the affected quantity/order without returning the flawed unit to trusted
stock. This phase does not introduce worker assignments, customer OTP, provider
refunds, or automatic customer messaging.

The shipment block is derived from the active variant quarantine rather than a
new general-purpose order-hold workflow. This keeps the launch design small and
automatically releases the block when the request is decided.

## Admin interface

The existing Inventory area gains a Requests tab and low-stock inspection state.

- Pending requests appear first and are grouped by variant.
- The row/card shows product identity, request category, original quantity,
  explanation, requester, request-time stock, current stock, and age.
- Green styling represents **checked—all fine**.
- Red styling represents a reported flaw or quarantine.
- Only admins and super admins see approve/reject controls.
- All staff may browse resolved request history.
- The Inventory sidebar item and Requests tab display the unresolved count and
  refresh after submission or decision.

No email or external messaging is added. Notifications use the existing in-app
system.

## History and deletion

Snapshots keep a request readable if its product labels or staff names later
change. If a user is deleted, the nullable reference may disappear but the name
snapshot remains. If a variant is deleted, historical requests remain readable;
a pending request for that variant cannot be approved and may only be rejected
with an explanation.

Inventory logs remain the movement ledger. Requests and inspections explain the
proposal and decision that led to a movement; they do not duplicate every order,
cancellation, or return as a request.

## Concurrency and repeat-action safeguards

- Checkout locks variants in stable order and validates sellable stock under the
  lock, so concurrent carts cannot cross the protected floor.
- Request approval locks the variant and applies its delta to current stock,
  never an absolute request-time target.
- Approval and rejection use a pending-status guard for idempotency.
- Cancellation and return paths must guard the credited quantity/status inside
  their stock transaction so concurrent or repeated actions cannot restock the
  same unit twice.
- Admin direct adjustments continue to use their existing lock and inventory
  log, then reconcile the inspection cycle and catalogue cache.
- Every stock or sellability change invalidates the catalogue data used by
  product cards and live availability.

## Errors and recovery

- A stale screen receives the new current stock and remains undecided; it never
  silently overwrites inventory.
- A failed inventory-log write rolls back the approval and stock change.
- A notification failure must not undo a valid request; the persistent pending
  count remains the reliable queue.
- An unavailable or deleted variant rejects new requests.
- Catalogue clients treat an uncertain refresh conservatively at checkout; a
  stale optimistic display never bypasses the server transaction.

## Development data

Fake seed variants should start at zero stock so development does not imply that
fictional inventory is physically verified. The current fake development
inventory may be reset to zero with an explicit, purpose-built seed/reset action.
Zeroing fake stock creates no inspection tasks.

This work must not run `pnpm db:migrate` on the current development database.
Schema application follows the repository's documented `db:push`/out-of-band
workflow when implementation begins.

## Verification requirements

Unit and integration coverage must prove at least:

- role gating for every request, inspection, and decision operation;
- all-fine completion changes no inventory and releases the floor;
- damaged/missing quarantine and extra-stock non-quarantine behavior;
- threshold transitions, zero-stock exclusion, cycle reset, and no duplicate
  inspection within one cycle;
- sellable quantities at 20, 19, 11, 10, 1, and 0;
- concurrent checkouts cannot cross the protected floor;
- approval uses current stock, creates exactly one log, and cannot be replayed;
- corrected approval and rejection explanation rules;
- negative-stock prevention after intervening sales;
- concurrent cancellation/return attempts cannot double-restock;
- deleted variants preserve history but cannot be approved;
- product card, product page, quantity control, cart, and checkout agree on
  availability;
- catalogue and pending-count invalidation after every relevant transition;
- seed data starts at zero without creating inspections.

The final implementation must pass lint, a clean-`.next` type-check, unit tests,
database integration tests, and a production build. Relevant staff and
storefront flows also receive a manual browser smoke test.

## Explicitly out of scope

- direct worker stock writes;
- worker assignments or specialist fulfilment roles;
- the future `media_buyer` role;
- OPay, provider refunds, customer OTP, and transactional messaging;
- purchase orders, supplier ETAs, and a general restock-management system;
- a generic workflow, policy, or order-hold engine.

## Delivery state

- **Implemented:** the existing stock-changing paths, inventory movement logs,
  staff role tiers, notifications, catalogue stock refresh foundation, and the
  customer-data access/audit work from commits `3f1e1ae` and `9abf092`.
- **Approved but unbuilt:** this complete inspection and adjustment
  request/review design, consistent sellability calculation, concurrency
  hardening, UI, notifications/counts, and fake-stock reset.
- **Externally blocked:** nothing in this phase.
