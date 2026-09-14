# Pre-launch handoff

**Updated:** 2026-09-15  
**Branch:** `codex/prelaunch-readiness`  
**Customer-access implementation commit:** `3f1e1ae`
**Documentation checkpoint:** the commit containing this handoff (inspect `HEAD`)

This is the short continuity document for starting a fresh Codex task. It records
the verified repository state, the brand owner's latest decisions, and the next
recommended phase. Detailed technical history belongs in the linked documents,
not here.

## Read this first in a new task

1. Read the repository `AGENTS.md` completely.
2. Read this file completely.
3. Check `git status`, the current branch, and recent commits before editing.
4. Re-verify any claim whose date or implementation may have changed.
5. Keep **implemented**, **approved but unbuilt**, and **blocked/deferred** work
   separate.

## Current checkpoint

The customer-data access and audit foundation is implemented. The last full
verification completed successfully on this branch:

- `pnpm type-check`
- `pnpm lint` — 0 problems
- `pnpm test` — 768/768 unit tests across 72 files
- `pnpm test:integration` — 54/54 tests across 5 files
- `pnpm build` — successful; 72 pages generated with the current development data

Run fresh verification before claiming a later change is complete. Clear `.next`
before trusting `pnpm type-check`, as required by `AGENTS.md`.

## Implemented and verified in the current phase

### Checkout and shipping

- Checkout requires an owned shipping address and a separate owned billing
  address.
- Egyptian governorate shipping rates and the free-shipping threshold are
  configurable in **Admin → Settings → Shipping**.
- The server calculates shipping from the selected shipping address; the client
  cannot choose or forge the charged rate.
- A free-shipping threshold is evaluated after coupon discounts.
- Orders keep address snapshots so saved-address edits or deletion do not rewrite
  historical orders.

### Catalogue performance

- Collection first pages are server-rendered and cached.
- Product and category mutations invalidate the relevant caches.
- Lightweight catalogue reads avoid loading heavy product detail data where it
  is not needed.
- Pagination has stable tiebreakers.
- Product images use the application's Next/Image and caching path; do not add a
  second image cache without measuring a real miss.

### Database and request path

- The development Neon database is in Frankfurt (`eu-central-1`) through its
  pooler.
- Duplicate indexes already covered by unique constraints were removed.
- Eight useful foreign-key indexes were added. The database now has 41 foreign
  keys: 33 covered and 8 intentional low-value exceptions.
- Request headers and the resolved client IP are carried in `TRPCContext`.
  Product search, newsletter subscription, and sign-in no longer call Next
  `headers()` outside the request context.
- The former three integration failures caused by that harness mismatch are
  resolved; the integration suite is fully green.

### Existing security and administration baseline

- Admin reads and writes are separate procedure tiers. A `worker` can read the
  current admin area but cannot perform general admin mutations.
- Security headers are configured, including HSTS, nosniff, Referrer-Policy,
  Permissions-Policy, enforced baseline CSP directives, and report-only
  script/style CSP directives.
- Consent disclosures, cookie transparency, legal content, rate-limit plumbing,
  order/address ownership checks, and anti-enumeration sign-in behavior exist.

### Customer-data access and audit foundation

- Workers see only active fulfilment orders (`pending`, `processing`, `paid`,
  `shipped`) in ordinary order lists and dashboard data.
- Worker order responses omit customer email at the SQL projection boundary.
  Order lists and staff detail reads do not hydrate shipping/billing snapshots,
  address rows, notes, or payment-gateway payloads.
- Opening an allowed order is audited. Shipping address and phone load only
  after **Show delivery details** persists a second audit event. Billing details
  are unreachable from staff order routes.
- Historical worker access is exact-email only, requires an unchecked explicit
  customer-request confirmation plus a reason, returns only historical orders,
  and creates a worker/customer-bound grant valid for 30 minutes.
- Admins and super admins retain the searchable name/email directory. Phone and
  saved shipping addresses require a reasoned, audited reveal. Birthday and
  billing details are absent from this UI.
- Order CSV export is admin/super only and is audited before the file is built.
- Audit rows retain actor-role snapshots and no raw revealed values. Retention
  uses the database clock for a rolling 12 months. Super admins see all rows;
  admins see their own rows plus another account's worker-era rows; workers see
  only their own rows.
- Sensitive customer operations now delegate through application use cases;
  the tRPC routers remain validation/adaptation boundaries.

## Development database state

The current development database already reflects the schema and index work in
`drizzle/0004` through `drizzle/0008`.

**Do not run `pnpm db:migrate` on this database.** The migration journal contains
only `0000` and `0001`; running it against a database created with `db:push` can
try to replay the baseline instead of applying the unjournalled files.

- `0002_search_trgm.sql` is deliberately unapplied. At the current catalogue
  size, sequential search is cheaper. Reconsider around thousands of rows or
  after measurement shows slow search.
- The data-update half of `0003_backfill_currency.sql` is deliberately unapplied.
  Old USD rows are seed fixtures with no corresponding charges; defaults are
  already EGP.
- `0004`–`0008` are applied to the development database but not journalled.
- `0008_customer_data_access_audit.sql` creates the additive audit table and
  its four indexes. It was applied directly and verified; do not replay it.
- Production will use a separate database. Design and verify its bootstrap at
  cutover; do not copy a migration command from an old note without checking
  the new database's actual state.

See `docs/PERFORMANCE.md` for measurements and migration details.

## Brand-owner decisions: approved but not necessarily built

Everything in this section is a product decision. Treat it as **unimplemented
unless the code and tests prove otherwise**.

### Payments and email

- Stripe is **not** the launch payment provider. OPay will be integrated after
  the brand paperwork and merchant access are ready.
- Payment-provider execution, including real electronic refunds, is deliberately
  on hold. The existing return model records returns but does not send money
  through a provider.
- Resend with the brand's verified sending domain is a launch requirement. The
  store will not launch without working transactional email.
- OPay and Resend credential work must remain provider-agnostic until real
  accounts, documentation, and test credentials exist.
- Do not store card credentials or card details in Valkyrie's database. The
  payment provider owns that data; Valkyrie stores only the minimum transaction
  references and statuses needed for orders, reconciliation, and refunds.

### Phone identity and OTP

- A phone number is required for a customer account.
- **Latest decision: one normalized phone number belongs to one account.** Phone
  OTP can be used for passwordless sign-in and account recovery; do not build an
  account picker for several accounts sharing one phone.
- This decision supersedes the many-accounts-per-phone model still described in
  `docs/PHONE-VERIFICATION.md` and `docs/LOYALTY-POINTS.md`. Those documents must
  be redesigned before their plans are implemented.
- OTPs are short-lived, hashed at rest, single-use, attempt-limited, and
  enumeration-safe. The requested send budget is approximately 5 messages per
  20 seconds, with both phone and IP protection; reassess the exact production
  limits against provider cost and abuse risk.
- The SMS/WhatsApp OTP provider is not chosen. WhatsApp verification is an
  option to evaluate for Egyptian deliverability and policy compliance, not an
  assumed implementation.

### Customer data and staff access

- The detailed launch design in **Customer-data access and audit foundation**
  above is implemented and supersedes the older broad statements here.
- Workers are fulfilment-wide at launch, not assigned to individual orders.
  Specialization and assignments wait until the team grows.
- A worker may reach historical orders only after entering the exact customer
  email, explicitly confirming that the customer requested support, and choosing
  a reason. Knowing or guessing an email is not itself treated as consent.
- Do not use a customer's OTP as an encryption key. Encryption at rest and key
  management are server responsibilities; OTP is an authorization signal.
- Staff handling an order may view the fulfilment data needed for that order
  without asking for a new OTP on every click. Checkout consent and the privacy
  notice must explain this operational use.
- Refund authorization follows the hardcoded policy in `docs/REFUNDS.md`.
  Every outcome requires a ten-second read-and-acknowledge gate; a positive
  refund also requires the one-minute, five-attempt customer OTP before staff
  completes the workflow. Provider-side money movement remains deferred until
  OPay exists.
- Access events should appear on the staff member's admin profile for owner/admin
  review.

### Birthday loyalty offer

- Birthday is not displayed in the staff/customer admin UI and is handled like
  other protected customer data.
- The future loyalty offer is a 20% birthday message/discount.
- Abuse prevention is one successful redemption per normalized, verified phone
  number in any rolling 365-day window. Changing the stored birthday does not
  reset eligibility.
- This is approved marketing/loyalty behavior but is not implemented in this
  phase. It belongs with the redesigned one-phone-one-account loyalty work.

### Inventory and fulfilment

- Workers do not directly overwrite inventory.
- Normal stock changes come from orders, cancellations, and approved returns.
- A worker who finds damaged, missing, or extra physical stock submits an
  adjustment request; an admin or super admin approves, corrects, or rejects it
  before stock changes.
- Multiple requests may remain pending for one variant. Approval applies a
  signed difference to the current locked stock, not an old absolute count, and
  records one inventory movement. The original request remains immutable.
- Entering 1-20 recorded units creates one worker inspection for that low-stock
  cycle. While unresolved, the final 10 units are protected. A green all-fine
  result releases them without admin review; damaged or missing stock
  quarantines the variant until review.
- Customers see **Temporarily unavailable - we're confirming availability**
  when inspection protection or quarantine prevents sale. Do not claim sold out
  or restocking when neither is true.
- Product cards, scrolling stock refresh, product detail, quantity controls,
  cart, and checkout must share the same sellable-stock rule. Checkout remains
  authoritative under a variant lock.
- Fulfilment should eventually store practical tracking data: carrier, tracking
  number/reference, shipment status, and relevant timestamps.

### Marketing leads and integrations

- Add leads as a first-class concept.
- Add a `media_buyer` role whose users can inspect only leads/customers attributed
  to campaigns they brought in.
- Support Meta Ads lead ingestion.
- Also support an inbound configurable JSON integration: an admin defines how
  an external payload maps into validated internal lead fields.
- Mapping configuration and integration credentials are admin-only.
- Keep raw payloads/audit metadata for troubleshooting, but never let arbitrary
  JSON write arbitrary database columns.

### Observability

- Keep Sentry error monitoring, but avoid broad session replay that consumes
  unnecessary Vercel resources or records low-value browsing.
- If replay is enabled, sample high-value flows such as checkout and failures;
  do not routinely record passive collection browsing.
- Mask sensitive input and customer data in both events and replay.

### Repository shape

- Keep the admin and storefront in this repository for now. They share the domain
  model, auth, orders, catalogue, and database, so splitting them would add
  deployment and contract overhead without yet creating a security boundary.
- Build stronger permission boundaries first. Reconsider a split only when teams,
  deployment cadence, or infrastructure isolation genuinely diverge.

## Decision Q&A ledger

This ledger paraphrases the questions and the brand owner's answers from the
pre-launch walkthrough. It is intentionally explicit because many answers in the
original conversation were short approvals such as “yes” or “sounds good.” When
an idea changed later, the **latest** answer is the one marked as current.

### Launch, payments, shipping, and messaging

| Question                                                                 | Brand-owner answer / decision                                                                                                                                      | State                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Is the published site already operating as a business?                   | No. It is published for walkthrough and preparation, but the brand is not open yet.                                                                                | Context                           |
| Should the Stripe gaps be treated as launch defects?                     | No. Stripe will not be used; electronic payment work waits for OPay and the brand paperwork.                                                                       | Deferred                          |
| How should shipping be priced?                                           | Require the customer's address and calculate the fee from the address/governorate using values managed in the admin Shipping tab.                                  | Implemented                       |
| When should the free-shipping threshold be applied?                      | Use the payable merchandise amount after coupon discounts.                                                                                                         | Implemented                       |
| Can the store launch before transactional email exists?                  | No. Resend is part of the required launch path, even though the sending email/domain is not ready yet.                                                             | External blocker                  |
| Can email-dependent flows be prepared before the email account is ready? | Yes, but final integration and delivery verification happen after Resend is provisioned.                                                                           | Approved                          |
| Should phone be optional?                                                | No. Phone is required because the store needs a reliable way to identify and contact the customer.                                                                 | Approved; verify every entry path |
| What messaging throttle was requested?                                   | Approximately 5 sent messages per 20 seconds, protected by phone and IP. Exact production limits should still be checked against provider cost and abuse behavior. | Approved target                   |
| Could WhatsApp be used for verification?                                 | Yes, evaluate it as an option; no provider has been chosen yet.                                                                                                    | Research later                    |

### Phone identity and account recovery

| Question                                                                  | Brand-owner answer / decision                                                                                                                           | State                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Should phone OTP sign-in need a password?                                 | No. A verified phone OTP is the passwordless proof for that sign-in path.                                                                               | Approved, unbuilt        |
| If one phone finds several accounts, should the customer pick an account? | This was considered, then rejected.                                                                                                                     | Superseded idea          |
| What is the current identity rule?                                        | One normalized phone number belongs to one account. Use phone OTP for sign-in/recovery so the customer can regain access and keep their history/points. | Latest approved decision |
| Can the existing loyalty/verification documents be implemented unchanged? | No. Their shared-phone/multiple-account model must be redesigned first.                                                                                 | Required redesign        |

### Customer data, privacy, and staff accountability

| Question                                                           | Brand-owner answer / decision                                                                                                                                               | State                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Should customer data be hashed and opened with an eye icon?        | The useful goal is masked display plus controlled reveal; hashing cannot support reversible viewing.                                                                        | Refined decision                              |
| Should an OTP itself be the encryption key?                        | No. The server owns encryption keys; OTP may authorize an action but must not be the cryptographic key.                                                                     | Rejected as overengineering/risky             |
| What customer fields stay visible and searchable?                  | Admin/super: name and email directory. Worker: customer name on active fulfilment orders; email hidden. Historical access begins with exact email supplied by the customer. | Implemented                                   |
| Can staff reveal other sensitive fields?                           | Yes when their role and work context allow it, and each reveal must create an audit record before the value is returned.                                                    | Implemented                                   |
| Where should those access records be visible?                      | On the staff/user page and a self-history page, scoped by the stored role snapshot on each event.                                                                           | Implemented                                   |
| Should customers provide an OTP every time staff views order data? | No. Legitimate order fulfilment data can be viewed without repeated OTP after clear checkout/privacy consent.                                                               | Approved                                      |
| Should every admin role see every customer record?                 | No. Workers have fulfilment-active scope plus the exceptional exact-email support path. Future media buyers are limited to attributed leads/customers.                      | Worker scope implemented; media buyer unbuilt |
| Is knowing the customer's email enough to claim consent?           | No. The worker must explicitly confirm the customer requested support and provided that email; every attempt is logged.                                                     | Implemented                                   |
| Should worker order access be individually assigned now?           | No. Every worker handles every active order at launch; assignments/specialization can be added when the team expands.                                                       | Implemented launch policy                     |
| Should birthday or billing details appear in staff UI?             | No. Birthday is not used in the current UI. Billing/card details are not exposed, and Valkyrie does not store card credentials.                                             | Implemented boundary                          |
| How is the future birthday offer protected from repeat use?        | One 20% redemption per normalized verified phone in a rolling 365-day window; changing birthday does not reset it.                                                          | Approved, unbuilt                             |
| Is this alone “data protection”?                                   | It is one layer. Real protection also requires least privilege, server-side encryption/secrets, logging, retention rules, secure transport, and incident controls.          | Design principle                              |

### Refunds, inventory, and fulfilment

| Question                                                 | Brand-owner answer / decision                                                                                                                                                                           | State                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| What return windows were approved?                       | 14 days for normal returns and 30 days for defective items.                                                                                                                                             | Approved policy; verify legal copy/workflow |
| Should a refund require customer confirmation?           | Yes. Use a customer OTP/confirmation gate before staff completes the refund workflow.                                                                                                                   | Approved, unbuilt                           |
| Should refund rules be editable in Settings?             | No. Refund windows, calculations, delivery treatment, goodwill percentage, OTP/evidence gates, and fee responsibility are hardcoded; changes require code.                                              | Approved policy; unbuilt                    |
| What is the approved refund calculation?                 | Unworn change-of-mind returns refund 100% of paid item value; worn but resellable change-of-mind returns may receive 70% goodwill; defective/wrong items refund 100% plus applicable original delivery. | Approved policy; unbuilt                    |
| Who pays delivery on a change-of-mind return?            | The original outbound delivery fee is not refunded; Valkyrie pays one return pickup. Rejected customer-caused returns keep the original fee and the customer pays collection.                           | Approved policy; unbuilt                    |
| What proof is required for a return?                     | Customer condition/package photos before pickup, then staff unboxing and inspection video before the final refund decision.                                                                             | Approved policy; unbuilt                    |
| Does the current refund button send money?               | No. It records the return/refund state; actual provider money movement waits for OPay.                                                                                                                  | Known limitation                            |
| Can a worker directly edit stock?                        | No. Routine inventory follows system events such as sale, cancellation, and approved return.                                                                                                            | Approved                                    |
| What if a worker finds extra, missing, or damaged stock? | The worker submits an immutable request; an admin/super admin approves, corrects, or rejects it before inventory changes.                                                                               | Design approved; unbuilt                    |
| May two workers report the same variant?                 | Yes. Keep both pending reports, group them for investigation, and let the reviewer approve valid findings or reject duplicates.                                                                         | Design approved; unbuilt                    |
| How is a stale adjustment request applied?               | Apply its signed difference to current stock under a row lock, never overwrite current stock with the old request-time count.                                                                           | Design approved; unbuilt                    |
| When should low-stock inspection begin?                  | Create one inspection per low-stock cycle when recorded stock enters 1-20. Zero stock creates no inspection.                                                                                            | Design approved; unbuilt                    |
| What happens while that inspection is pending?           | Protect the final 10 units. At 11 only one is sellable; at 10 the variant is temporarily unavailable.                                                                                                   | Design approved; unbuilt                    |
| What happens after an all-fine inspection?               | Record it immediately in green without admin review and allow the verified remainder to sell below 10 down to zero.                                                                                     | Design approved; unbuilt                    |
| What happens when a flaw is reported?                    | Damaged/missing quarantines the variant pending review; existing trusted stock stays sellable for an extra-stock report.                                                                                | Design approved; unbuilt                    |
| What should customers see during protection/quarantine?  | “Temporarily unavailable - we're confirming availability.” Say “restocking” only when an actual incoming restock exists.                                                                                | Design approved; unbuilt                    |
| Where should unresolved work be visible?                 | On the Inventory Requests tab and as a count beside Inventory in the staff sidebar, using the existing in-app notification system.                                                                      | Design approved; unbuilt                    |
| What does “tracking information” mean?                   | The shipment carrier, tracking/reference number, delivery status, and relevant fulfilment timestamps shown to staff/customer as appropriate.                                                            | Approved concept, unbuilt                   |

### Roles, leads, and external data

| Question                                                            | Brand-owner answer / decision                                                                              | State                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------- |
| Add a media-buyer role?                                             | Yes.                                                                                                       | Approved, unbuilt         |
| What may a media buyer inspect?                                     | Only the leads/customers attributable to campaigns they brought; not the whole customer database.          | Approved, unbuilt         |
| Are leads part of the model?                                        | Yes, add them explicitly.                                                                                  | Approved, unbuilt         |
| Is the configurable JSON integration for sending or receiving data? | Receiving external JSON and mapping its fields into the internal lead model.                               | Clarified, unbuilt        |
| What JSON shape should be accepted?                                 | Do not force one external shape. Let an admin configure a mapping into a fixed, validated internal schema. | Approved design direction |
| Should Meta Ads be included?                                        | Yes, add Meta Ads lead integration as a supported source.                                                  | Approved, unbuilt         |
| Who configures field mappings and integration credentials?          | Admin only.                                                                                                | Approved, unbuilt         |
| May an incoming payload write arbitrary database fields?            | No. It must pass the configured mapping, validation, attribution, deduplication, and audit path.           | Safety constraint         |

### Operations, performance, and architecture

| Question                                                                   | Brand-owner answer / decision                                                                                                            | State                                                        |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Should Sentry record every storefront page?                                | No. Prefer errors and selective replay for high-value flows such as checkout; avoid routine collection browsing and mask sensitive data. | Approved, unbuilt/configuration pending                      |
| Should admin features move to another repository now?                      | No. Keep one repository and improve authorization boundaries first.                                                                      | Approved                                                     |
| Will production reuse the development database?                            | No. Provision a separate production database when preparing to launch.                                                                   | Approved future operation                                    |
| What regions were added?                                                   | The brand owner reported adding `fra1` and `dxb1`. Verify the actual hosting configuration before depending on either.                   | Reported external state                                      |
| Should rarely changing catalogue data be cached aggressively?              | Yes, especially product listing data and images, with correct invalidation when admin changes occur.                                     | Implemented in the current caching phase; continue measuring |
| Was the database currently large enough to justify trigram search indexes? | No. The development database is tiny; add them later only when row counts or measured query time justify their write/storage cost.       | Deliberately deferred                                        |
| Did the current database need `db:migrate` after the index work?           | No. The applicable SQL was verified/applied directly; the journal layout makes `db:migrate` unsafe for this database.                    | Completed/no action                                          |
| Were the foreign-key indexes approved after their purpose was explained?   | Yes. Add the useful eight, retain the low-value exceptions, and test the invariant.                                                      | Implemented                                                  |
| Should the missing security headers be added?                              | Yes.                                                                                                                                     | Implemented                                                  |
| Should this long task move to a new task after closing the database phase? | Yes, with a durable Markdown handoff so context does not depend on the chat transcript.                                                  | This document                                                |

### Working style

| Question                                                   | Brand-owner answer / decision                                                                                                     | State                |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Who makes the final product decisions?                     | The user is the brand owner.                                                                                                      | Standing context     |
| Should Codex merely agree or give a strong recommendation? | Be opinionated, explain the reasoning, and prevent unnecessary overengineering.                                                   | Standing instruction |
| How should unclear choices be handled?                     | Explain what happens and why, then ask/confirm decisions rather than making the owner guess.                                      | Standing instruction |
| How should a large phase be continued?                     | Keep a clean branch, document the checkpoint, and start the next task from the handoff rather than re-deriving the whole project. | Standing workflow    |

## Deliberately deferred or externally blocked

- OPay merchant onboarding, payment capture, webhook handling, reconciliation,
  and electronic refunds — blocked on brand paperwork/provider access.
- Resend production sending and end-to-end delivery testing — blocked on the
  brand email/domain setup.
- Phone/WhatsApp OTP delivery — blocked on selecting and provisioning a provider.
- Production database creation and cutover checks — wait until the production
  environment is intentionally provisioned.
- Search trigram indexes — wait for measured need.
- Neon autosuspend changes — infrastructure choice; revisit if real users report
  slow first requests after idle.

These are known dependencies, not current code defects.

## Recommended remaining phases

1. **Inventory adjustment request/review.** The product design is approved in
   `docs/superpowers/specs/2026-09-15-inventory-adjustment-request-review-design.md`.
   The implementation plan is in
   `docs/superpowers/plans/2026-09-15-inventory-adjustment-request-review.md`.
   Review the plan, choose an execution style, then implement it without
   expanding into later phases.
2. **Refund authorization workflow.** Implement the hardcoded policy and
   evidence/confirmation gates in `docs/REFUNDS.md`, but do not pretend to move
   money before OTP and OPay behavior are known.
3. **Identity and messaging.** Update the old phone/loyalty designs for one phone
   per account, then implement Resend and the chosen OTP provider when credentials
   exist.
4. **OPay payments and reconciliation.** Implement only against confirmed OPay
   APIs and merchant behavior, including idempotent webhooks and partial refunds.
5. **Leads, media-buyer scope, JSON mapping, and Meta Ads.** Build on the shipped
   access controls; external ingestion must never bypass validation or
   campaign attribution.
6. **Production cutover.** New database bootstrap, secrets, rate limits, email,
   monitoring, human smoke tests, and rollback/reconciliation procedures.

Do not combine all phases into one implementation branch. Design one phase,
approve it, implement it, verify it, and update this handoff.

## Immediate next task

The **Inventory adjustment request/review** analysis, product design, and
implementation plan are complete. The immediate next step is brand-owner
review of
`docs/superpowers/plans/2026-09-15-inventory-adjustment-request-review.md`.
After approval, choose subagent-driven or inline execution and implement it as
its own phase. Do not re-open the settled product questions unless
implementation uncovers a real contradiction or unsafe edge case. Do not
include OPay, OTP, direct worker stock writes, assignments, or the future
media-buyer role.

## Source-of-truth documents

- `AGENTS.md` — current architecture, commands, traps, and verified baseline
- `docs/superpowers/specs/2026-09-14-customer-data-access-and-audit-design.md`
  — approved design record for the completed customer-access phase
- `docs/superpowers/specs/2026-09-15-inventory-adjustment-request-review-design.md`
  — approved design record for the next inventory-operations phase
- `docs/superpowers/specs/2026-09-15-refund-authorization-evidence-design.md`
  — approved-but-unbuilt refund policy, confirmation, and inspection-evidence design
- `docs/superpowers/plans/2026-09-15-inventory-adjustment-request-review.md`
  — task-by-task implementation plan for that approved design
- `docs/superpowers/plans/2026-09-14-customer-data-access-and-audit.md` —
  implementation plan and verification record for that phase
- `docs/ISSUES.md` — defect catalogue and resolved-history details
- `docs/PERFORMANCE.md` — measured performance and database index state
- `docs/REFUNDS.md` — what return recording does and does not do
- `docs/GO-LIVE.md` — deployment checklist, but its Stripe section is obsolete
  for the approved OPay direction
- `docs/POST-LAUNCH.md` — cutover/manual smoke-test detail; re-check old test counts
  and migration wording against this handoff and the live database
- `docs/PHONE-VERIFICATION.md` and `docs/LOYALTY-POINTS.md` — older designs that
  must be revised for the one-phone-one-account decision
- `docs/PRIVACY-SHIELD-PLAN.md` and `docs/MARKETING-CONSENT-SPEC.md` — legal and
  consent planning; verify any remaining placeholders before launch

## Copy-paste prompt for the next task

> Continue the Valkyrie pre-launch work in `C:\dev\val-store`. Read `AGENTS.md`
> and `docs/PRELAUNCH-HANDOFF.md` completely before acting, then verify the branch
> and working tree. Treat the handoff Q&A ledger as my latest approved product
> decisions. The customer-data access and audit foundation is complete; do not
> redesign or repeat it. The **Inventory adjustment request/review** design and
> plan are approved in
> `docs/superpowers/specs/2026-09-15-inventory-adjustment-request-review-design.md`
> and
> `docs/superpowers/plans/2026-09-15-inventory-adjustment-request-review.md`.
> Choose an execution style, then implement and verify only that phase. Preserve
> the approved request, inspection, quarantine, availability, concurrency, and
> customer-copy decisions. Clearly separate implemented, approved-but-unbuilt,
> and externally blocked work. Do not run
> `pnpm db:migrate` on the current development database.
