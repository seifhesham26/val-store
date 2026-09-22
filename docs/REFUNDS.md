# Refund authorization, evidence, and payout

**Status:** Implemented on `codex/refund-authorization-evidence`, but not yet
verification-clean or launch-ready. This supersedes the earlier “recorded now,
paid later” note. **Decided:** 2026-09-17. **Verified:** 2026-09-21.

The inventory adjustment phase is separate and already implemented. This phase
adds a customer return request, staff inspection, admin approval/rejection,
customer read-and-OTP authorization, private evidence, and verified payout.

## What is implemented today

Commits `675824e` through `ce2facc` add the hardcoded policy, return requests,
inspection/proposal records, separate physical and payout state, private evidence
metadata and audited signed-link service, customer acknowledgment/OTP gates,
staff/admin routes and UI, carrier claims, and idempotent payout/reconciliation
boundaries. The old direct `admin.orders.refund` mutation is removed. Financial
line quantities and shipping refund totals are recorded only after a payout is
reported as verified and succeeded; physical restocking remains separate.

This is not a claim that money can move in production. The wired WhatsApp OTP
provider and OPay transport deliberately fail closed until real provider
credentials, authenticated responses/webhooks, and reconciliation behavior are
available and tested.

The 2026-09-21 Task 10 verification is not clean:

- Focused refund/admin-gating suite: 59/59 tests across 6 files.
- Lint and a fresh `.next` type-check exited successfully.
- Full unit suite: 904/905 tests across 90 files. The remaining failure is the
  stale catalogue-invalidation source assertion, which still expects the removed
  direct admin refund path to contribute a second call.
- Production build compiled and completed TypeScript, then failed while
  collecting `/api/webhook/stripe` because this worktree has no
  `STRIPE_SECRET_KEY`.
- The configured integration suite started against the development database but
  produced no test result before it was stopped after more than two minutes.

The security review also found one launch-blocking trust-boundary defect:
`admin.returns.recordInspection` / `approveProposal` currently accept paid line
amounts, delivery, collection, captured-payment, and payout-destination values
from the admin client, and `RecordReturnInspectionUseCase` uses them to persist
the proposal. Those values must be resolved from locked order/payment/return
records before this workflow is launchable.

## Approved hardcoded policy

Refund rules are application constants, not Settings or database data. Changing
them requires a code change, tests, review, and deployment.

- Normal change-of-mind requests are eligible for 14 days; defective, wrong, or
  misdescribed items for 30 days.
- Unworn or try-on-only change-of-mind items receive 100% of the actual paid item
  amount. Worn but still resellable items may receive 70% goodwill.
- Defective, wrong, or misdescribed items receive 100% of the actual paid item
  amount. Original outbound delivery is refunded only when the whole delivered
  order is returned because of Valkyrie’s objective fault. A partial
  merchant-fault return refunds the item and Valkyrie-paid pickup, not outbound
  delivery; if the remaining items later complete a full merchant-fault return,
  outbound delivery is refunded once at most.
- Accurate product with subjective dislike, fit, look, or feel is change of mind.
  The delivery service is separate from product quality; its fee is refunded
  only for Valkyrie fault or misleading representation.
- Customer-caused damage, washing, alteration, stains, odor, missing tags, or
  other loss of resellable condition rejects that line. The original delivery
  remains charged and the customer pays the actual collection fee if they want
  the rejected item shipped back. Free in-store pickup is always available.
- Coupon discounts are allocated proportionally. Refunds never exceed captured
  money and coupons are not restored.

## Operational workflow

1. The customer selects one or more lines and gives a detailed reason. Multiple
   attempts are allowed after rejection, but each is a new request with fresh
   evidence and a new reason.
2. The customer uploads exactly two private photos: the item condition, and the
   safely sealed package/label with declared package count. Photos are limited to
   JPG/PNG/WebP and 10 MB each. Browser compression is allowed; originals and
   metadata remain private. The photo deadline is 48 hours.
3. An admin authorizes pickup or in-store return. After authorization the customer
   has seven days to hand the parcel to the courier or bring it to the store;
   expiry releases the pending reservation and allows a later fresh attempt.
4. Packages should be consolidated where practical; three units per package is
   guidance, not a hard block. The customer declares the count and confirms the
   seal. At handoff, one continuous courier video starts with the order/return
   reference and declared count, then shows the sealed packages and handoff.
5. The courier records the actual package count and reference manually at launch.
   Receiving staff verifies the count before opening, then records one continuous
   unboxing/inspection video. A second receiving worker verifies the count. Open,
   damaged, or broken-seal packages are quarantined for admin review.
6. Package mismatches are investigated before fault is assigned. Workers record
   observed facts, counts, condition, and evidence only. Admins classify customer,
   carrier, Valkyrie, or unresolved fault; super-admins open actual media and
   handle final appeals, missing evidence, and carrier exceptions.
7. A proposal is built per line and quantity. Physical disposition (resellable,
   damaged quarantine, or missing) is separate from financial refund and payout.
   Resellable stock may become sellable after an accepted return even while an
   electronic payout is pending; damaged and missing units are never restocked.
8. Every customer outcome requires a server-recorded ten-second read gate and
   acknowledgment. A positive refund additionally requires a one-minute OTP to
   the verified account phone. OTPs expire after 60 seconds, resend after 60
   seconds, invalidate the prior code, allow five wrong attempts, and have phone
   and IP abuse protection. Proposal changes invalidate the acknowledgment and
   OTP. Rejections require the read gate but no OTP.
9. A customer may dispute a judgment with a detailed explanation. Payout stays
   paused and the item quarantined; one admin review is allowed, then super-admin
   is final. A dispute does not silently expire. Untouched customer actions move
   to `customer_action_required` after seven days with reminders and no automatic
   refund, rejection, restock, or disposal.
10. Physical, evidence, payout, and carrier-claim statuses remain separate. The
    final customer summary is sent through WhatsApp with an in-app mirror; the
    system never says money was paid before verified provider success.

## Missing packages and carrier claims

- Refund verified received quantities first. For a missing remainder, open the
  carrier investigation after the first refund and refund the unresolved amount
  after three calendar days without an outcome. For an all-missing return, open
  the claim immediately and apply the same three-day rule.
- If Valkyrie confirms its own fault, refund immediately. If evidence is
  unavailable, the customer is not penalized. If the courier count was wrong or
  the carrier loses a matched handoff, classify the carrier fault and pursue a
  claim; a later carrier decision never claws back a completed customer refund.

## Payout and fallback

OPay is the approved launch provider, but merchant access, API documentation,
credentials, webhook behavior, and testing are external blockers today.

- OPay refunds only the original payment source and uses an idempotency key.
  Pending or unknown responses remain locked for reconciliation, never a fresh
  payout. Only a definitive failure permits up to three retries over 24 hours.
- COD that was never delivered has no captured payment to refund. COD already
  collected may be refunded as cash in-store; a worker may hand over the exact
  approved amount because workers run the cash registry, but cannot alter the
  decision or amount. A receipt closes the payout.
- After confirmed OPay failure, a fresh proposal, read gate, and OTP are required
  for an offline cash or Egyptian e-wallet fallback. Wallet numbers are never
  entered on the website; the customer/admin agree offline. The private wallet
  screenshot must show provider, success, exact amount, date, and masked recipient.
  Manual fallback may link to the verified order even when the customer has no
  receipt. In-store identity uses OTP plus receipt, or admin/super-admin manual
  verification with two matching order details.

## Evidence and privacy

Customer photos, courier/receiving videos, and payout screenshots are private
evidence, never public upload URLs. Store metadata, hashes, validation state, and
audit events. Ordinary staff see structured findings; only super-admins may open
actual media through short-lived signed URLs. Retain media for 12 months after
closure, then delete it while retaining financial and decision notes without
unnecessary personal data. Corrupt, blurry, or non-continuous video triggers a
retry/re-record or audited exception; it never alone rejects the customer. If
Valkyrie lacks evidence, the customer receives the applicable refund protection.

## Launch gates and current blockers

The workflow may be implemented and tested with provider adapters, but launch
requires live, tested WhatsApp notifications/OTP and OPay payment/refund
execution with reconciliation. Resend’s verified sending domain is also a launch
requirement. SMS is later work. No provider is allowed to be represented as
successful from a timeout, client claim, or database status alone.

Before provider work, fix the client-trusted inspection amounts, update the stale
catalogue-invalidation test for the removed refund bypass, obtain a successful
full integration result, and repeat the build in an intentionally configured
environment. Authenticated customer/admin/super-admin browser smoke remains
outstanding. The signed evidence service is super-admin-only and audited, but the
current admin viewer is explanatory UI rather than a complete media-opening flow.

Do not run `pnpm db:migrate` on the current development database. Additive schema
work, if approved for implementation, uses `pnpm db:push`.

## Related source of truth

- `docs/superpowers/specs/2026-09-15-refund-authorization-evidence-design.md`
- `docs/superpowers/plans/2026-09-15-refund-authorization-evidence.md`
- `docs/PRELAUNCH-HANDOFF.md`
