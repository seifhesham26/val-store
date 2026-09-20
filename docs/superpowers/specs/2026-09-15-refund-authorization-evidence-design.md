# Refund authorization, evidence, and payout design

**Status:** Approved product design; implementation pending
**Decision date:** 2026-09-17

## Scope

This phase adds a fair, evidence-backed return workflow around the existing
partial-return model. It separates physical return disposition from financial
refund status and requires admin approval plus customer confirmation before a
refund is recorded. It includes OPay and WhatsApp boundaries required for
launch; SMS, OTP alternatives, assignments, direct worker stock writes, and
`media_buyer` remain out of scope.

## Hardcoded refund policy

Refund policy is code-owned, not a database setting and not editable in admin.
Changing it requires a code change, tests, review, and deployment.

- Unworn or try-on-only change of mind: refund 100% of the actual paid item
  amount. Keep the original outbound delivery fee; Valkyrie pays one return
  pickup.
- Worn but resellable change of mind: refund 70% of the actual paid item
  amount as goodwill. Keep outbound delivery; Valkyrie pays one pickup.
- Defective, wrong, or materially misdescribed item: refund 100% of actual paid
  item amount plus applicable original delivery. Valkyrie pays pickup.
- Customer-caused damage, washing, alteration, stains, odor, missing tags, or
  other loss of resellable condition: reject, refund nothing, retain outbound
  delivery, and charge the actual collection fee if the customer requests the
  item shipped back.

Use the existing proportional coupon allocation. Coupons are not restored and
refunds never exceed captured payment. Mixed outcomes are calculated per line
and per quantity.

## End-to-end operational flow

1. Customer requests a return from order details. A request may be partial and
   may be retried after a prior rejection, but a retry requires a detailed new
   reason and fresh evidence.
2. Admin checks eligibility: 14 days for normal returns, 30 days for defective,
   wrong, or materially misdescribed items. The customer chooses courier pickup
   or free in-store handoff. In-store is available for every payment method.
3. Before pickup, the customer uploads exactly two private photos: the product
   condition and the sealed package/label. All units should be consolidated;
   three units per package is the recommended capacity, not a hard block. The
   customer declares package count and confirms the package is safely sealed.
   A technical failure creates an audited exception, never an automatic
   rejection.
4. The courier records one continuous handoff video beginning with the
   order/return reference and declared package count, then showing every sealed
   package and the handoff. The courier confirms the actual count. A worker may
   record an admin-approved exception only when the carrier cannot provide the
   video.
5. Receiving confirms the package count before opening and records one
   continuous unboxing/inspection video showing label, seal, opening, product,
   tags, quantity, and condition. A second receiving staff member verifies the
   count. Disagreement becomes `count_disputed` and requires admin review.
6. Each quantity receives a physical outcome: `resellable`, `damaged_quarantine`,
   or `missing_not_received`. A separate refund proposal records item amount,
   delivery treatment, collection responsibility, and payout destination.
7. Workers record facts and evidence only. Admins classify fault and approve or
   reject. Super-admins are the final appeal authority and the only role allowed
   to open actual media. Admins normally decide from structured counts, labels,
   and written findings; super-admin media review is required for disputes,
   missing evidence, count disputes, and carrier-fault exceptions.
8. The customer receives the proposal in-app and through WhatsApp. Every
   outcome has a server-clock ten-second read/acknowledgment gate. Positive
   refunds additionally require a one-minute, single-use OTP with five wrong
   attempts maximum; resend is allowed after 60 seconds and invalidates the
   previous code. OTP is sent only to the verified account phone through
   WhatsApp at launch. SMS is later work.
9. Any changed amount, quantity, condition, delivery fee, or destination creates
   an immutable proposal version and invalidates prior acknowledgment/OTP.
   Disagreement is a customer action: the customer submits a detailed reason,
   payout pauses, and the item stays quarantined. One admin review is followed
   by super-admin escalation. A revised proposal requires a new read gate and
   OTP.
10. After OTP acceptance, accepted resellable quantities become sellable even if
    OPay is pending. Damaged quantities stay quarantined; missing quantities are
    not restocked. Physical `returnedQuantity` and financial `refundedQuantity`
    are separate facts. OTP acceptance cannot be casually cancelled; before
    dispatch an admin may cancel with proof of the customer request, after
    dispatch the customer pays actual incurred delivery cost, and after receipt
    it is an inspection/dispute case.

## Packaging, carrier, and missing quantities

The customer is never trusted by declaration alone. We compare customer photo
and count, courier handoff video/count, Valkyrie receiving count, and unboxing
video. Open, damaged, or broken-seal packages are quarantined and reviewed.
Every discrepancy requires one fault classification: `customer`, `carrier`,
`valkyrie`, or `unresolved`.

If the courier submits the wrong package count, that is carrier fault. If some
quantities are received, refund those verified quantities first; the three-day
carrier investigation clock for the missing remainder starts after that first
refund. If all quantities are missing, open the delivery investigation
immediately; after three calendar days without an outcome, refund the full
approved quantity. Once refunded, later carrier reimbursement or denial never
changes the customer’s completed refund.

If evidence is unavailable or unusable, Valkyrie does not penalize the customer.
The system records an evidence exception and the applicable refund proceeds
when the policy/evidence rules require it.

## Payouts, COD, and evidence privacy

OPay is a launch prerequisite. A payout is `pending` until OPay gives a verified
success response or webhook. Timeouts and unknown states are reconciled, never
retried as fresh payouts. Only a definitive failure permits up to three retries
over 24 hours using the same idempotency key. After confirmed failure, offer
cash or a manually agreed Egyptian e-wallet fallback; both require a new
proposal, ten-second read, and OTP. Wallet/bank details are never entered on
the public website. A successful e-wallet screenshot is attached internally;
cash uses the cash-register receipt in store, while online/manual fallback may
be linked to the verified order even when the customer has no receipt.

Evidence and payout screenshots live in private storage, not public upload
URLs. Files are immutable, request-scoped, short-lived when viewed, and access
is audited. Screenshots must show provider, successful status, exact amount,
transaction/reference ID, date/time, and masked recipient. Customer photos and
handoff/inspection media are retained privately for 12 months after closure,
then deleted; financial facts and decision notes remain.

## Notifications and reporting

WhatsApp is the primary customer channel; in-app mirrors every state. Record
delivery success/failure and never claim a message was delivered if it was not.
Show the admin sidebar pending count for unresolved returns. Final customer
communication summarizes received/missing quantities, physical outcomes, refund
amount, delivery/collection fees, payout method/status, and any open carrier
claim. Track physical return, evidence review, refund/payout, and carrier claim
as separate statuses. If a proposal is untouched for seven days, move it to
`customer_action_required`; do not auto-refund, reject, or restock.

## Testing and non-goals

Tests must cover policy branches, coupon allocation, mixed quantities, stale
proposal versions, concurrent finalization, evidence authorization, private
media, package/count discrepancies, dispute escalation, OTP lifecycle, OPay
idempotency/reconciliation, fallback payouts, and worker/admin/super-admin
permissions. Never run `pnpm db:migrate` on the current development database;
use the approved additive schema workflow when implementation begins.
