# Refund authorization and inspection evidence

**Status:** Approved product design; implementation pending  
**Decision date:** 2026-09-15

## Scope

This phase adds the customer-to-admin authorization and inspection-evidence
workflow around the existing partial-return model. It does not redesign order
returns, inventory adjustment requests, payment-provider integration, or the
customer-data audit foundation. Real provider-side money movement remains
blocked until OPay is available.

## Code-owned policy

Refund policy is hardcoded in the application, not stored in a database settings
table and not editable from the admin UI. The database stores transaction facts
and the calculated proposal, not policy configuration.

- Unworn or try-on-only change-of-mind return: refund 100% of the actual amount
  paid for the returned items. The original outbound delivery fee is not
  refunded; Valkyrie pays one return pickup.
- Worn but still resellable change-of-mind item: offer a 70% goodwill refund of
  the actual amount paid. The original outbound delivery fee is not refunded;
  Valkyrie pays one return pickup. This is not a statutory percentage.
- Defective, wrong, or misdescribed item: refund 100% of the actual amount paid
  plus applicable original delivery. Valkyrie pays the return pickup, including
  when normal wear preceded discovery of the defect.
- Customer-caused damage, washing, alteration, stains, odor, missing tags, or
  other loss of resellable condition: reject the change-of-mind return, issue no
  refund, retain the original delivery fee, and charge the customer collection.

The calculation uses existing proportional coupon allocation and cannot exceed
the captured amount. Coupons are not restored.

## Roles and state flow

1. An authenticated customer starts a return from order details, selecting lines,
   quantities, and a reason. This changes no stock and sends no money.
2. An admin reviews eligibility and authorizes pickup instructions. Workers may
   handle fulfilment and upload evidence but cannot approve a refund.
3. Before pickup, the customer reseals an open package and uploads a product
   condition photo plus a sealed-package/label photo. Pickup is not scheduled
   until this evidence is present, except through an audited media exception.
4. Receiving staff records an unboxing and inspection video before opening the
   package. It shows the seal, label, opening, product, tags, quantity, and
   condition/defect.
5. An admin reviews the evidence and records the condition outcome and calculated
   proposal. A media failure creates an exception/re-inspection path, never an
   automatic rejection.
6. The customer sees the itemized amount, delivery treatment, condition result,
   and COD destination. Every outcome has a hardcoded ten-second read gate and
   acknowledgment. A positive refund then requires a one-minute, single-use,
   five-attempt OTP; a rejected outcome requires acknowledgment but no OTP.
7. A changed amount, condition, fee, quantity, or COD destination invalidates the
   acknowledgment and OTP and starts the confirmation sequence again.
8. After confirmation, the system records the approved refund/return facts.
   Provider execution is a separate idempotent step when OPay exists.

## Delivery and COD rules

The original outbound delivery fee is retained for change-of-mind outcomes. A
defective or wrong-item outcome refunds the applicable original delivery and
Valkyrie pays return pickup. A rejected customer-caused outcome retains the
original delivery and charges collection. COD customers select an agreed bank
or mobile-wallet destination; paid online orders use the original payment
method.

## Data and safety boundaries

Persist the request, line quantities, reason, evidence metadata/links, inspection
result, calculated amounts, delivery amounts, customer acknowledgment, OTP
events, reviewer identity, timestamps, and final status. Do not persist a
mutable policy configuration. Restrict evidence to the customer, involved
fulfilment staff, admins, and super admins as appropriate; it is not public.

The final calculation is saved with the request so later code changes cannot
rewrite an approved outcome. No refund may be approved twice for the same
quantity. Rejected requests do not use OTP and do not change stock.

## Testing and non-goals

Unit tests cover each policy branch, coupon allocation, rounding, fee treatment,
OTP expiry/resend/attempt limits, timer resets, evidence requirements, and
duplicate approval guards. Integration tests cover concurrent review, changed
proposals, media exceptions, COD destinations, and the existing partial-return
quantity bound.

This phase does not add OPay calls, direct worker stock writes, assignments,
media-buyer permissions, or arbitrary formula/configuration editors.
