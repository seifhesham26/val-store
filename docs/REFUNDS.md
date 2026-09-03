# Refunds — recorded now, paid later

**Status** Deliberate and deferred, **not a defect**. Waiting on the payment
gateway decision — Stripe is not settled, so the code that moves money has no
provider to move it through yet.
**Decided** 2026-09-03

## What works today

The whole return model, and it is the harder half:

- Returns are **per line and partial**. `order_items.refunded_quantity` is the
  only stored fact; everything else is derived from it, so nothing can drift.
- Refunded value is **scaled by what the customer actually paid**
  (`OrderEntity.paidFraction()`), so a coupon order returns the discounted
  price rather than the list price.
- Restocking is **per line and separate from the refund** — a damaged return
  gets the customer their money without putting the item back on sale.
- The bound is enforced **inside the transaction**, so two admins refunding the
  same line at once cannot together return more units than were bought.
- The order reaches `refunded` only when every unit has come back; a partial
  return leaves it open and still returnable.
- Dashboard revenue is already **net of returns** (`revenue.ts`), using the
  same `paidFraction` arithmetic as the entity, with an integration test
  asserting the two agree.

## What does not work

**No money is sent anywhere.** There is no call to any payment provider's
refund API in the codebase — `StripeService` has no refund method, and nothing
else does either. `refund()` updates `refunded_quantity`, restocks, appends an
admin note, sets `payments.payment_status = 'refunded'` and notifies the
customer. The card is never credited.

For cash on delivery this is close to correct already: money was collected by
hand and is returned by hand, and the record is the point. For card orders it
is a genuine gap.

## The interim exposure, stated plainly

This is deferred, not harmless, and whoever operates the store should know:

- The admin button reads **"Refund EGP 750"**.
- The customer receives an **"order refunded"** notification.
- `payments.payment_status` becomes **`refunded`**.
- The dashboard **deducts it from revenue**.

Nothing in that chain is qualified with "recorded, not yet paid". An admin who
has not read this file will reasonably believe the customer has their money
back, and the customer will believe it too.

Until the gateway lands, refunds must be **issued by hand in the payment
provider's own dashboard**, and this system treated as the record of what was
returned rather than the thing that returns it.

If that hand-off is likely to be missed, the cheapest mitigation is wording:
change the button to "Record a return" and the notification to say the refund
is being processed. That is a one-line change in `CloseOrderDialog.tsx` and
`NotificationService.orderRefunded()`, and it costs nothing to reverse once
money actually moves.

## What to build once the gateway is chosen

1. **A refund call on the payment service.** The provider needs the original
   transaction id, which is already stored: `payments.transaction_id` holds the
   Stripe Checkout Session id, and the payment intent id is in
   `payment_gateway_response`. Whatever replaces Stripe needs the equivalent
   captured at payment time — check this when picking a provider.
2. **Partial refunds must be supported.** The return model is partial by
   design, so a provider that only refunds whole payments would force a rewrite
   of the half that already works. This is a selection criterion, not an
   implementation detail.
3. **Idempotency.** Follow `markAsPaid`: a conditional write that reports
   whether it actually transitioned, so a retried request cannot pay twice.
   Money out deserves at least the care money in already gets.
4. **Order the writes so a failure is safe.** Call the provider first and
   record only on success. The reverse — recording, then failing to send —
   produces an order that says it was refunded when it was not, which is
   precisely today's state made permanent.
5. **Reconciliation.** A refund that fails at the provider must leave the units
   returnable, not silently consumed.
6. **Then remove the wording caveat above**, if it was applied.

## Related

- Loyalty clawback assumes refunds are real: points are returned as
  `floor(cash returned)`. See `docs/LOYALTY-POINTS.md` section 4. That is
  consistent today because the clawback is a record too — both halves become
  real together.
- COD payments are marked `completed` on delivery, not at checkout, so a COD
  refund's "captured payment" precondition is already correct.
