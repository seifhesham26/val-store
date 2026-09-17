# External integrations and launch roadmap

**Updated:** 2026-09-17
**Scope:** OPay, WhatsApp, Resend, production services, and later marketing integrations
**Status:** Roadmap only; provider contracts and credentials are not yet complete

This document collects the remaining work that depends on external providers or
production accounts. It is an execution checklist, not a replacement for the
approved refund, phone-verification, or go-live designs.

## Current state

| Area               | Repository state                                              | Launch state                                                                      |
| ------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Card checkout      | Stripe Checkout adapter and webhook exist                     | Must be replaced or deliberately retained until OPay is confirmed                 |
| Cash on delivery   | Existing order path records COD orders                        | Usable, but manual collection/refund operations remain                            |
| OPay               | No adapter, credentials, webhook, or reconciliation code      | Blocked on merchant onboarding and confirmed API behavior                         |
| WhatsApp           | No provider adapter, templates, OTP, or delivery webhook      | Blocked on provider selection, business verification, and credentials             |
| Resend             | Adapter exists and sends order, verification, and reset email | Blocked on verified production domain and delivery testing                        |
| UploadThing        | Product/category upload route exists                          | Requires production-origin verification and a private evidence design for returns |
| Upstash            | Rate-limiter integration exists                               | Must be configured in production; unset variables disable limits                  |
| Phone verification | Domain idea exists, no implementation                         | Deferred until provider and one-phone identity decisions are finalized            |
| Analytics and ads  | No analytics or Meta Pixel is installed                       | Optional code phase before paid traffic                                           |

## Rules for every provider

- Keep provider-specific code behind an application interface and an
  infrastructure adapter. Domain and use-case code must not import an SDK.
- Store provider references, not secrets or full raw credentials, in database
  records. Secrets belong in the hosting provider's encrypted environment.
- Verify signatures on every webhook before parsing business data.
- Make webhook handling idempotent. The same event may be delivered more than
  once, out of order, or after the browser has timed out.
- Persist an internal event/request id before acknowledging a webhook when the
  provider contract requires durable deduplication.
- Treat `pending`, timeout, and unknown provider responses as reconciliation
  states. Never convert them into success because a request was sent.
- Log safe identifiers and state transitions, never OTPs, access tokens, full
  card data, wallet details, or unmasked customer evidence.
- Add sandbox tests and a production smoke test for every money or messaging
  path. A successful HTTP response alone is not proof of settlement or delivery.

## Phase 0: Confirm providers and commercial prerequisites

Do this before writing an OPay or WhatsApp adapter.

### OPay decisions required

- [ ] Create and verify the Egyptian OPay merchant account.
- [ ] Obtain the official API documentation for the exact merchant product:
      checkout/payment creation, payment status, webhooks, and refunds.
- [ ] Confirm supported settlement currency and amounts in EGP.
- [ ] Confirm whether OPay supports partial refunds by amount and whether it
      supports the store's per-line partial-return model.
- [ ] Confirm webhook authentication, event names, retry policy, and signing
      algorithm.
- [ ] Confirm idempotency-key behavior for payment creation, status queries,
      and refunds.
- [ ] Confirm whether COD is outside OPay and remains a manual operational path.
- [ ] Confirm settlement timing, chargeback/dispute behavior, fees, and the
      merchant support escalation path.
- [ ] Obtain separate sandbox and production credentials.

**Selection rule:** do not commit to an OPay flow that cannot represent a
partial refund and a durable pending/unknown state. The existing return model
is intentionally partial; changing it to fit a whole-order-only provider would
discard already-tested behavior.

### WhatsApp decisions required

- [ ] Choose Meta WhatsApp Cloud API or an approved Business Solution Provider.
- [ ] Verify the WhatsApp Business Account, business, display name, and sending
      phone number.
- [ ] Confirm Egyptian `+20` delivery, pricing, throughput, and template review
      times.
- [ ] Decide whether the provider supports delivery/read status webhooks and
      how failed messages are queried.
- [ ] Create and approve templates for refund proposals, OTP delivery, return
      status, payout status, and operational customer updates.
- [ ] Define opt-in, opt-out, quiet-hour, and customer-support escalation rules.
- [ ] Obtain separate test and production credentials, webhook verification
      values, and the provider's data-retention terms.

WhatsApp is the launch channel for refund OTP and return notifications. SMS is
not a fallback in this phase. A provider outage must leave the request awaiting
customer action or provider delivery; it must not auto-confirm a refund.

## Phase 1: Production foundations

### Required existing production configuration

- [ ] Set `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`, and `BETTER_AUTH_URL`
      to the chosen canonical production origin.
- [ ] Configure `DATABASE_URL` and verify the production schema using the
      approved additive workflow. Do not run `pnpm db:migrate` against the current
      development database.
- [ ] Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; verify that
      sign-in, password reset, newsletter, search, reviews, and CSP-report limits
      are active.
- [ ] Configure `RESEND_API_KEY`, verify `valkyrie-eg.com` in Resend, set a
      real `EMAIL_FROM`, and test order, reset, and verification email delivery.
- [ ] Configure `UPLOADTHING_TOKEN` and verify the production origin.
- [ ] Configure OAuth redirect URIs for the canonical host if Google or
      Facebook login is enabled.
- [ ] Confirm `NEXT_PUBLIC_STORE_CURRENCY=EGP`, locale, timezone, and production
      secrets are set in the hosting dashboard rather than only in local `.env`.
- [ ] Keep `NODE_ENV` platform-managed and ensure no development credentials
      reach production.

The detailed DNS, OAuth, Resend, UploadThing, Stripe, and Search Console steps
remain in [`docs/GO-LIVE.md`](./GO-LIVE.md). The application-side cutover checks
remain in [`docs/POST-LAUNCH.md`](./POST-LAUNCH.md).

### Proposed new environment variables

These names are suggestions for the eventual adapters, not current repository
configuration. Final names should be chosen when the provider contracts are
approved.

```text
OPAY_ENV=sandbox|production
OPAY_MERCHANT_ID=...
OPAY_CLIENT_ID=...
OPAY_CLIENT_SECRET=...
OPAY_WEBHOOK_SECRET=...

WHATSAPP_PROVIDER=cloud_api|bsp
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_APP_SECRET=...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=...
```

Do not add these variables with fake values just to make the build pass. The
application should fail closed with a typed provider-unavailable state.

## Phase 2: OPay payments

### Adapter and application work

- [ ] Introduce a payment-provider interface for create payment, query payment,
      verify webhook, and create refund operations.
- [ ] Keep provider selection out of domain entities. The use case should know
      the internal payment intent/order contract, while the OPay adapter translates
      provider payloads.
- [ ] Capture the OPay payment reference at order creation. Preserve the
      internal order id and order number separately from the provider reference.
- [ ] Replace or explicitly gate the current Stripe checkout path once OPay is
      the approved launch gateway. Do not leave both options visible unless the
      business has intentionally approved both.
- [ ] Add an OPay webhook route with signature verification, event deduplication,
      out-of-order handling, and safe replay behavior.
- [ ] Transition an order to `paid` only after a verified captured/success state.
      A browser redirect is never sufficient.
- [ ] Handle failed, expired, cancelled, pending, and unknown payments without
      losing the order or double-restocking inventory.
- [ ] Add a reconciliation job or admin operation that queries unresolved OPay
      references and records the definitive provider state.
- [ ] Add provider-safe observability: internal order id, provider reference,
      event id, state transition, and timestamp.

### OPay tests and acceptance

- [ ] Unit-test payload mapping, signature validation, idempotency, and every
      provider state.
- [ ] Integration-test duplicate webhooks, out-of-order events, timeout after
      provider success, and payment failure after an order was created.
- [ ] Test two checkout attempts against the same stock and confirm the
      existing inventory locks still hold.
- [ ] Complete one sandbox payment and one sandbox failure/expiry.
- [ ] Complete one controlled production payment for a real small amount and
      reconcile it from the OPay dashboard.
- [ ] Confirm order status, payment status, cart clearing, stock movement,
      notifications, and email all agree after the webhook.

## Phase 3: WhatsApp messaging and OTP

### Messaging boundary

- [ ] Create a `WhatsAppMessageProvider` interface with send-template,
      delivery-status, and provider-error results.
- [ ] Implement the selected provider in infrastructure only.
- [ ] Store internal message records with template name, recipient hash or
      masked phone, provider message id, status, timestamps, and safe error code.
- [ ] Accept delivery/read/failure webhooks only after verification and make
      them idempotent.
- [ ] Keep in-app notifications as the source-of-truth mirror. Never show
      “delivered” when WhatsApp only accepted the request or delivery failed.
- [ ] Add rate limits per phone and IP for OTP requests, plus a resend cooldown.
- [ ] Normalize Egyptian numbers to E.164 before provider calls.

### Refund OTP

- [ ] Implement the one-minute, single-use, five-attempt OTP lifecycle from the
      approved refund design.
- [ ] Hash the OTP with a server-side secret; never store or log the plaintext
      code.
- [ ] Invalidate a previous challenge on resend and invalidate acknowledgment
      and OTP when the proposal version changes.
- [ ] Send only to the verified account phone through WhatsApp at launch.
- [ ] Return a typed provider-unavailable result when WhatsApp is not configured
      or delivery is not verified. Do not mark the return confirmed in that case.
- [ ] Test wrong attempts, lockout, expiry, resend, replay, provider failure,
      duplicate requests, and concurrent confirmation.

The detailed refund workflow is in
[`docs/superpowers/specs/2026-09-15-refund-authorization-evidence-design.md`](./superpowers/specs/2026-09-15-refund-authorization-evidence-design.md)
and its implementation plan is in
[`docs/superpowers/plans/2026-09-15-refund-authorization-evidence.md`](./superpowers/plans/2026-09-15-refund-authorization-evidence.md).

## Phase 4: Refund payout and return workflow

The current application records returns but does not move money. The new flow
must keep physical disposition, financial authorization, and provider payout as
separate facts.

- [ ] Implement the approved hardcoded refund policy and per-line calculations.
- [ ] Implement private customer photos, courier handoff evidence, receiving
      inspection video, evidence exceptions, and audited media access.
- [ ] Remove the direct admin refund bypass before exposing the new finalization
      path.
- [ ] Require admin approval, the ten-second read/acknowledgment gate, and the
      WhatsApp OTP for positive refunds.
- [ ] Finalize only from stored approved proposal facts; never trust client
      totals, quantities, fees, or payout destinations.
- [ ] Call OPay with one stable idempotency key per payout attempt.
- [ ] Keep a payout `pending` through timeout or unknown provider state and
      reconcile it. Do not retry an unknown state as a new payout.
- [ ] Retry only definitive failures, at most three times over 24 hours, using
      the provider-approved idempotency behavior.
- [ ] After confirmed failure, use the approved manual cash or Egyptian e-wallet
      fallback process. Collect no wallet/bank details on the public website.
- [ ] Attach internal proof of successful payout with provider, amount,
      reference, timestamp, and masked recipient.
- [ ] Tell the customer whether the return is recorded, payout pending, payout
      completed, or payout failed. Never call a recorded/pending return “refunded”
      until the product decision and provider state justify that wording.

## Phase 5: Resend and transactional communications

- [ ] Add and verify the production sending domain in Resend.
- [ ] Configure SPF, DKIM, DMARC, bounce handling, and a real sender address.
- [ ] Set `NEXT_PUBLIC_APP_NAME=Valkyrie` explicitly in production.
- [ ] Test order confirmation for COD and online payment, password reset, and
      email verification with real inboxes.
- [ ] Confirm every link uses the canonical production origin.
- [ ] Record provider delivery failures in logs/monitoring without blocking the
      already-committed order transaction.
- [ ] Add refund/return email only if the product decision keeps email as a
      secondary channel to WhatsApp; do not create conflicting state messages.

## Phase 6: Phone verification and identity hardening

This is separate from refund OTP. Refund OTP authorizes one return proposal;
phone verification establishes trust for the customer's phone identity.

- [ ] Reconcile `docs/PHONE-VERIFICATION.md` and `docs/LOYALTY-POINTS.md` with
      the approved one-normalized-phone-per-account rule.
- [ ] Decide how phone changes, recycled numbers, re-verification, and customer
      row merges work before exposing self-service phone edits.
- [ ] Choose whether the same WhatsApp provider can serve loyalty verification
      or whether it needs a separate provider contract.
- [ ] Build a hashed, single-use verification challenge with ten-minute expiry,
      five-attempt cap, per-phone/per-IP send limits, and per-customer verify limits.
- [ ] Preserve identical responses for existing and unknown phone numbers to
      prevent enumeration.
- [ ] Gate loyalty redemption server-side on `is_phone_verified`.

## Phase 7: Optional analytics and marketing integrations

Do this before paid traffic, not after it.

- [ ] Choose GA4, Vercel Analytics, or another privacy-reviewed analytics tool.
- [ ] Decide whether Meta Pixel is permitted by the consent/legal plan.
- [ ] Implement consent-aware page, product-view, add-to-cart, checkout-start,
      and purchase events without sending raw customer data.
- [ ] Add server-side order attribution only after consent and retention rules
      are agreed.
- [ ] Design the future lead model and `media_buyer` role separately from
      customer-data access.
- [ ] Add Meta Ads lead ingestion and configurable JSON mapping only through a
      validated, attributed, audited ingestion path.

## Launch acceptance gates

The store is not ready to claim the relevant capability until every applicable
gate passes in sandbox and then production.

### Money

- [ ] A successful OPay payment reaches `paid` only from verified provider
      evidence.
- [ ] A duplicate or delayed webhook cannot pay, notify, or clear the cart twice.
- [ ] A failed/unknown payment can be reconciled without double-restocking.
- [ ] A partial refund returns only the approved quantity and amount.
- [ ] A timeout does not create a second payout.
- [ ] The provider dashboard, database, customer UI, admin UI, and notification
      history agree on the final state.

### WhatsApp

- [ ] OTP arrives on a verified Egyptian number in the approved template.
- [ ] Wrong, expired, replayed, and superseded codes fail correctly.
- [ ] Provider failure leaves the return awaiting action and exposes a safe
      retry/error state.
- [ ] Delivery failures are visible internally and are not reported as success.
- [ ] No plaintext OTP or access token appears in logs, database rows, or error
      responses.

### Email and production

- [ ] Resend domain is verified and real inbox delivery succeeds.
- [ ] Canonical URLs, OAuth callbacks, sitemap, and email links use one host.
- [ ] Upstash limits are active in production.
- [ ] Production uses a separate database and correct EGP defaults.
- [ ] Evidence and payout screenshots are private, short-lived, and audited.
- [ ] A human completes the staff and customer smoke tests from
      [`docs/GO-LIVE.md`](./GO-LIVE.md) and [`docs/POST-LAUNCH.md`](./POST-LAUNCH.md).

## Recommended execution order

1. Confirm OPay and WhatsApp contracts, accounts, sandbox access, templates,
   webhook rules, and idempotency behavior.
2. Finish the refund authorization/evidence workflow without provider-money
   claims.
3. Build and test the WhatsApp adapter and refund OTP boundary.
4. Build and test the OPay payment adapter and reconciliation path.
5. Connect approved refund finalization to OPay payout execution.
6. Configure Resend, UploadThing, Upstash, OAuth, DNS, and production secrets.
7. Run the money, messaging, security, and human launch gates.
8. Add analytics and lead/Meta integrations only after the launch path is stable.

## Explicit non-goals for this roadmap

- Do not add SMS as a hidden WhatsApp fallback.
- Do not accept wallet or bank details through the public website.
- Do not mark a provider request as successful merely because it returned HTTP
  200 or because the customer reached a redirect page.
- Do not let workers approve refunds or open private evidence media.
- Do not make refund policy, OTP limits, or payout retry limits editable in the
  admin settings UI.
- Do not run `pnpm db:migrate` on the current development database.

## Source documents

- [`docs/GO-LIVE.md`](./GO-LIVE.md) — external console, DNS, OAuth, Resend,
  UploadThing, Stripe, and Search Console setup
- [`docs/POST-LAUNCH.md`](./POST-LAUNCH.md) — application-side cutover checks
- [`docs/REFUNDS.md`](./REFUNDS.md) — current recorded-return limitation
- [`docs/superpowers/specs/2026-09-15-refund-authorization-evidence-design.md`](./superpowers/specs/2026-09-15-refund-authorization-evidence-design.md) — approved refund workflow
- [`docs/superpowers/plans/2026-09-15-refund-authorization-evidence.md`](./superpowers/plans/2026-09-15-refund-authorization-evidence.md) — implementation plan
- [`docs/PHONE-VERIFICATION.md`](./PHONE-VERIFICATION.md) — deferred phone identity verification
- [`docs/LOYALTY-POINTS.md`](./LOYALTY-POINTS.md) — loyalty dependency on verified phone identity
- [`docs/PRELAUNCH-HANDOFF.md`](./PRELAUNCH-HANDOFF.md) — current verified project state
