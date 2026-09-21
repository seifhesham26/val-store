# Refund Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` in a fresh task for each implementation task below. Execute the tasks sequentially on `codex/refund-authorization-evidence`, use Terra medium for implementation, and make exactly one task-scoped commit per task. After every implementation task is complete, run one full-branch review with Sol high.

**Goal:** Resolve all ten findings from the review of Tasks 1-10 so return evidence is actually private, quantities and money cannot be double-authorized, every financial/evidence decision is server-owned, rejected and disputed flows are reachable, OTP issuance is concurrency-safe and throttled, and physical restocking invalidates every storefront catalogue cache.

**Architecture:** Keep refund rules pure in `src/domain/refunds`, but move authorization into locked repository transactions. A return line explicitly reserves units from request creation until it is released or converted to a completed refund. Inspection accepts only observed quantities/classifications; one repository transaction locks the request, order, order lines, payment, evidence, and current proposal, derives paid value and payout destination, validates evidence and quantities, and writes the inspection plus immutable proposal. Evidence stays private in UploadThing and can be opened only by a super admin through an audited, five-minute signed URL. Physical completion, financial payout, carrier claims, and catalogue invalidation remain separate and observable.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, tRPC v11, Drizzle/PostgreSQL, UploadThing 7.7, Upstash rate limiting, Tailwind 4/shadcn, Vitest, pnpm.

**Branch:** `codex/refund-authorization-evidence`

**Original spec:** `docs/superpowers/specs/2026-09-15-refund-authorization-evidence-design.md`

**Review baseline:** `main..b144118`

---

## Documentation discovery and fixed decisions

### Sources consulted

- Repository sources: `src/db/schema.ts`, `src/domain/refunds/*`, `src/application/refunds/*`, `src/infrastructure/database/repositories/refunds/*`, `src/lib/uploadthing.ts`, both return routers, and both customer/admin return components.
- [UploadThing file-route configuration](https://docs.uploadthing.com/file-routes): route configuration supports `acl: "private"`; per-route ACL overrides require **Allow Overriding ACL** in the UploadThing dashboard.
- [UploadThing Regions & ACL](https://docs.uploadthing.com/concepts/regions-acl): the default is URL-accessible unless the application default or route ACL is private.
- [UploadThing `UTApi.generateSignedURL`](https://docs.uploadthing.com/api-reference/ut-api#generatesignedurl): private media should be opened with a short-lived signed URL; the existing five-minute lifetime is supported.
- [PostgreSQL row locking](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS): `SELECT ... FOR UPDATE` serializes conflicting writers. All return creation/finalization paths must acquire order and order-line locks in a consistent order.

### Decisions that implementation must not reopen

1. `return_request_items.reserved_quantity` is the durable reservation. Creation sets it to the requested quantity while holding the order and sorted order-line locks. A terminal zero-refund outcome releases it; verified payout success converts approved reserved units to `order_items.refunded_quantity`; missing units stay reserved while a carrier claim is open.
2. The admin browser may send observations only: request id, expected status/version, counts, outcome, fault, and customer-facing explanation. It may not send paid amount, captured amount, delivery refund, collection fee, payout destination, evidence readiness, or restock quantity.
3. `totalRefund` is money paid to the customer: `itemRefund + deliveryRefund`, capped by captured payment and prior/pending refund holds. `collectionDue` is a separate receivable if the customer asks for a rejected item to be shipped back. It is never subtracted from a refund.
4. Restock quantity is derived. Only `unworn` and `worn_resellable` units may be restocked, and then only up to the approved inspected quantity. Defective, damaged, missing, and rejected units are quarantined or claimed, never put on sale.
5. A direct admin rejection is not immediately terminal. It creates a versioned zero-refund proposal with a reason; the customer must pass the ten-second read gate and acknowledge it. A wholly rejected zero-refund proposal then becomes terminal `rejected` without OTP. Any positive proposal, including a mixed outcome, still requires OTP and completes as `recorded`.
6. Evidence exceptions are immutable audit records with phase, missing kinds, reason, actor, and timestamp. A bare status transition or client boolean is never sufficient.
7. The current unavailable WhatsApp and OPay adapters remain fail-closed. This plan fixes internal authorization; it does not invent undocumented provider contracts.

### Finding-to-task map

| Review finding                                            | Remediation task |
| --------------------------------------------------------- | ---------------- |
| P0 evidence uploads may be public                         | Task 3           |
| P0 overlapping requests can double-refund/restock/pay     | Task 2           |
| P1 browser controls money/destination                     | Task 4           |
| P1 quantity and restock invariants are incomplete         | Tasks 1 and 4    |
| P1 evidence prerequisites are client asserted             | Tasks 3 and 4    |
| P1 zero-refund/mixed outcomes have no correct completion  | Task 5           |
| P1 OTP resend race and abuse limits                       | Task 6           |
| P1 package/dispute/claim/inspection flows are unreachable | Task 7           |
| P2 legacy direct refund API remains                       | Task 8           |
| P2 restock does not invalidate catalogue caches           | Task 8           |

---

## Task 1: Define the corrected domain invariants

**Files:**

- Modify: `src/domain/refunds/refund-policy.ts`
- Modify: `src/domain/refunds/refund-policy.test.ts`
- Modify: `src/domain/refunds/return-request.ts`
- Modify: `src/domain/refunds/return-request.test.ts`
- Modify: `src/domain/refunds/interfaces/return-request.repository.interface.ts`

**Interfaces:**

```ts
export interface InspectionDecisionLine {
  requestItemId: string;
  receivedQuantity: number;
  inspectedQuantity: number;
  approvedQuantity: number;
  outcome: InspectionOutcome;
  fault: ReturnFault;
}

export function assertInspectionQuantities(input: {
  requestedQuantity: number;
  receivedQuantity: number;
  inspectedQuantity: number;
  approvedQuantity: number;
}): void;

export function restockedQuantityFor(input: {
  approvedQuantity: number;
  outcome: InspectionOutcome;
}): number;
```

- [ ] **Step 1: Write failing table tests for quantity ordering**

Cover `0 <= approved <= inspected <= received <= requested`, integer-only quantities, zero received lines, and every invalid adjacent inversion. Add an explicit regression that `approved=2, inspected=1` is rejected.

- [ ] **Step 2: Write failing outcome/restock tests**

Assert that only `unworn` and `worn_resellable` derive a non-zero restock. `defective`, `customer_damage`, `damaged_quarantine`, and `missing_not_received` must derive zero even if the caller supplies a positive approved quantity.

- [ ] **Step 3: Lock the money semantics in domain tests**

Add mixed-outcome cases proving:

- `totalRefund === itemRefund + deliveryRefund` after the captured-payment cap.
- `customerCollectionDue` is reported separately and never reduces `totalRefund`.
- a zero-refund rejected proposal may still have `customerCollectionDue > 0`.
- a mixed proposal with at least one approved line is positive and therefore OTP-required later.

- [ ] **Step 4: Implement the minimal pure helpers and types**

Add `InspectionDecisionLine` as the replacement contract, but keep the current persistence method temporarily so this task ends type-clean. Task 4 performs the atomic interface cutover and removes `restockedQuantity`, `paidAmount`, and all aggregate money fields from the public inspection command.

- [ ] **Step 5: Run focused verification**

Run:

```bash
pnpm vitest run src/domain/refunds/refund-policy.test.ts src/domain/refunds/return-request.test.ts
pnpm type-check
```

Expected: domain tests and type-check pass. Do not commit an intentionally broken intermediate contract.

- [ ] **Step 6: Commit**

```bash
git add src/domain/refunds
git commit -m "fix(refunds): Define inspection invariants"
```

---

## Task 2: Reserve return units and cap aggregate payout exposure

**Files:**

- Modify: `src/db/schema.ts`
- Modify: `src/db/relations.ts` if relation typing changes
- Modify: `src/domain/refunds/return-request.ts`
- Modify: `src/domain/refunds/interfaces/return-request.repository.interface.ts`
- Modify: `src/infrastructure/database/repositories/refunds/return-request.repository.ts`
- Modify: `src/infrastructure/database/repositories/refunds/refund-payout.repository.ts`
- Modify: `src/infrastructure/database/repositories/refunds/return-request.repository.integration.test.ts`
- Create: `src/infrastructure/database/repositories/refunds/refund-payout.repository.integration.test.ts`

**Schema changes:**

```ts
reservedQuantity: integer("reserved_quantity").default(0).notNull();
```

Add database checks for non-negative requested/reserved/received/inspected/approved/restocked/refunded quantities. Keep the existing unique `(request_id, order_item_id)` constraint.

- [ ] **Step 1: Write the failing overlapping-request integration test**

Create one delivered order line with quantity one. Start two concurrent `create()` calls for that same unit. Assert exactly one request commits, the loser reports that the quantity is reserved, and the winning line stores `reservedQuantity=1`.

- [ ] **Step 2: Write reservation-release/conversion tests**

Cover:

- a zero-refund acknowledged completion releases the reservation;
- an approved positive return retains only the approved quantity while payout is pending;
- verified payout success atomically decrements the request reservation and increments `order_items.refunded_quantity` once;
- retry/reconciliation of the same payout does not convert twice;
- an open missing-item carrier claim retains its missing reservation.

- [ ] **Step 3: Implement deterministic creation locking**

Inside `DrizzleReturnRequestRepository.create()`:

1. Lock the parent order.
2. Lock requested `order_items` sorted by id with `FOR UPDATE`.
3. Sum `return_request_items.reserved_quantity` for those lines after the locks are held.
4. Enforce `requested <= quantity - refundedQuantity - reservedQuantity`.
5. Insert the request items with `reservedQuantity=requestedQuantity` in the same transaction.

Never infer reservation solely from request status; the stored quantity is the single source of truth.

- [ ] **Step 4: Add the aggregate payout-cap integration test**

For two independent request records on a multi-unit order, prepare both payouts concurrently. Include `pending`, `unknown`, and `succeeded` payout rows in the held total. Assert the second provider call is never prepared when:

```text
existing held/succeeded payouts + proposed payout > captured payment
```

Also assert shipping refund exposure does not exceed `orders.shipping_amount` after `orders.refunded_shipping_amount` and pending proposal holds.

- [ ] **Step 5: Enforce the cap before any provider call**

`DrizzleRefundPayoutRepository.prepare()` must lock the order and completed payment row, calculate the order-wide held amount, and persist the payout only if it fits. The `RefundPayoutService` must receive no `action: "initiate"` result on a cap conflict.

- [ ] **Step 6: Apply additive schema through the approved workflow**

Run `pnpm db:push`, inspect the SQL, and confirm it only adds the reservation column/checks/indexes. Do not run `pnpm db:migrate`.

- [ ] **Step 7: Run focused verification**

```bash
pnpm vitest run --config vitest.integration.config.ts src/infrastructure/database/repositories/refunds/return-request.repository.integration.test.ts src/infrastructure/database/repositories/refunds/refund-payout.repository.integration.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add src/db/schema.ts src/db/relations.ts src/domain/refunds src/infrastructure/database/repositories/refunds
git commit -m "fix(refunds): Reserve quantities and cap payouts"
```

---

## Task 3: Make evidence private, complete, and auditable

**Files:**

- Modify: `src/lib/uploadthing.ts`
- Modify: `src/infrastructure/services/uploadthing-evidence-storage.service.ts`
- Modify: `src/infrastructure/services/uploadthing-evidence-storage.service.test.ts`
- Modify: `src/domain/refunds/interfaces/return-request.repository.interface.ts`
- Modify: `src/infrastructure/database/repositories/refunds/return-request.repository.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/db/relations.ts`
- Modify: `src/server/routers/admin/returns.ts`
- Modify: `src/server/admin-write-gating.test.ts`
- Modify: `src/components/admin/returns/ReturnEvidenceViewer.tsx`
- Modify: `src/components/admin/returns/types.ts`
- Create: `scripts/privatize-return-evidence.ts`
- Modify: `package.json`

**Interfaces:**

```ts
listEvidence(requestId: string): Promise<ReadonlyArray<{
  id: string;
  kind: ReturnEvidenceKind;
  mimeType: string;
  sizeBytes: number;
  validationState: ReturnEvidenceValidationState;
  createdAt: Date;
}>>;

recordEvidenceException(input: {
  requestId: string;
  phase: "pre_pickup" | "courier_handoff" | "receiving";
  missingKinds: ReturnEvidenceKind[];
  reason: string;
  actorId: string;
}): Promise<void>;
```

- [ ] **Step 1: Add failing UploadThing route tests/source assertions**

Assert all three evidence routes declare `acl: "private"`, return no URL or storage key to the browser, and use the spec limits: customer photos 10 MB each; courier/receiving videos 256 MB each; one file per evidence kind.

- [ ] **Step 2: Configure private routes and the missing courier video**

Add `acl: "private"` to `returnCustomerEvidence`, `returnCourierHandoffEvidence`, and `returnReceivingEvidence`. The courier route accepts only `kind: "courier_handoff_video"`, exactly once per request, while the request is in a handoff-eligible state. Permit the owning customer or authenticated staff, and persist the actual uploader role.

The UploadThing dashboard must enable **Allow Overriding ACL** before deployment. Record that as an external environment check; code must still fail closed if the configured private route cannot issue an upload.

- [ ] **Step 3: Add immutable evidence-exception persistence**

Create `return_evidence_exceptions` with request, phase, missing kinds, reason, actor, and timestamp. Replace `admin.returns.mediaException` with `recordMediaException`; require `adminWriteProcedure`, a non-empty reason, and at least one missing kind. Remove the bare `evidence_exception` transition as proof of an exception.

- [ ] **Step 4: Expose metadata and audited media opening**

Add:

```ts
admin.returns.listEvidence({ requestId }); // adminProcedure, metadata only
admin.returns.openEvidence({ requestId, evidenceId }); // adminSuperProcedure
```

`openEvidence` resolves the storage key server-side, inserts `return_evidence_access_audits`, then calls `UTApi.generateSignedURL(key, { expiresIn: 300 })`. It returns only the signed URL. Ordinary workers/admins never receive storage keys.

- [ ] **Step 5: Build the actual super-admin viewer**

Render evidence kind, validation state, timestamp, and size to staff. For super admins only, provide an explicit “Open for 5 minutes” action that calls `openEvidence`; do not put signed URLs in list data or retain them in persistent client state.

- [ ] **Step 6: Cover pre-existing files**

Add a dry-run-by-default script that reads only keys from `return_evidence` and calls `UTApi.updateACL(keys, "private")` with `--apply`. It must refuse production unless `--confirm-production` is also supplied. Add the script as `evidence:privatize` in `package.json` and document the exact operational invocation in Task 9.

- [ ] **Step 7: Run focused verification**

```bash
pnpm vitest run src/infrastructure/services/uploadthing-evidence-storage.service.test.ts src/server/admin-write-gating.test.ts
pnpm lint
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/uploadthing.ts src/infrastructure/services src/domain/refunds src/infrastructure/database/repositories/refunds src/db src/server src/components/admin/returns scripts/privatize-return-evidence.ts package.json pnpm-lock.yaml
git commit -m "fix(refunds): Enforce private evidence access"
```

---

## Task 4: Make inspection and proposal creation one server-owned transaction

**Files:**

- Modify: `src/application/refunds/use-cases/record-return-inspection.use-case.ts`
- Modify: `src/application/refunds/refund-workflow.use-cases.test.ts`
- Modify: `src/domain/refunds/interfaces/return-request.repository.interface.ts`
- Modify: `src/infrastructure/database/repositories/refunds/return-request.repository.ts`
- Modify: `src/infrastructure/database/repositories/refunds/return-request.repository.integration.test.ts`
- Modify: `src/server/routers/admin/returns.ts`
- Create: `src/server/routers/admin/return-inspection-input.test.ts`

**Public command:**

```ts
recordInspectionDecision(input: {
  requestId: string;
  expectedStatus: ReturnRequestStatus;
  expectedProposalVersion: number;
  reviewerId: string;
  customerCopy: string;
  lines: readonly InspectionDecisionLine[];
}): Promise<ReturnRequestRecord>;
```

- [ ] **Step 1: Write a router-input regression test**

The test must fail if `inspectionInput` accepts any of these keys:

```text
paidAmount, originalDelivery, returnedAllOrder, collectionFee,
capturedPayment, payoutDestination, evidenceComplete,
auditedMediaException, restockedQuantity, itemRefund,
deliveryRefund, totalRefund
```

- [ ] **Step 2: Write repository integration tests for server-derived truth**

Use deliberately hostile browser values at the tRPC boundary and prove they are rejected by strict Zod parsing. Then call the repository command with observations only and assert:

- paid line value is `unit_price * approved_quantity * ((subtotal - discount)/subtotal)`, rounded once to cents;
- delivery remaining comes from `orders.shipping_amount - refunded_shipping_amount` and is allowed only by policy;
- captured money comes from the completed payment/order facts;
- `returnedAllOrder` is derived from already completed refunds plus the current approved lines; unrelated pending reservations do not make this proposal a full-order return;
- payout destination/provider comes from the stored payment method and verified account boundary, never free text;
- restock quantity is derived from the outcome helper;
- stale expected status/version loses without a partial inspection write.

- [ ] **Step 3: Require persisted evidence in the same transaction**

While holding the locked request row:

- pickup authorization requires both `customer_product_photo` and `customer_package_photo`, unless a `pre_pickup` evidence-exception row covers the missing kinds;
- inspection/proposal creation requires `receiving_inspection_video`, unless a `receiving` exception covers it;
- any evidence marked `invalid`, `missing`, or `corrupt` does not satisfy the requirement;
- client booleans and the request status alone never satisfy evidence.

Update `AuthorizeReturnPickupUseCase` to call a repository method that performs its evidence check and transition atomically.

- [ ] **Step 4: Collapse inspection and proposal persistence**

Replace the current `recordInspection()` followed by `saveProposal()` sequence with the single locked method. Within one transaction:

1. Lock request, order, request items/order items in stable id order, and payment.
2. Validate status/version, evidence, quantities, reservation fit, and captured payment.
3. Derive restock quantities and all money.
4. Insert the new immutable proposal version.
5. Update inspection facts and move to `awaiting_customer_confirmation`.
6. Reset proposal-opened, acknowledgment, confirmation, and all outstanding OTP challenges for the prior version.

Any failure rolls back every write.

- [ ] **Step 5: Remove the duplicate mutation**

Keep one `admin.returns.recordInspection` mutation. Delete `approveProposal`, because both currently call the same use case and present two paths to the same write.

- [ ] **Step 6: Run focused verification**

```bash
pnpm vitest run src/application/refunds/refund-workflow.use-cases.test.ts src/server/routers/admin/return-inspection-input.test.ts
pnpm vitest run --config vitest.integration.config.ts src/infrastructure/database/repositories/refunds/return-request.repository.integration.test.ts
pnpm type-check
```

- [ ] **Step 7: Commit**

```bash
git add src/application/refunds src/domain/refunds src/infrastructure/database/repositories/refunds src/server/routers/admin
git commit -m "fix(refunds): Derive inspection proposals on server"
```

---

## Task 5: Complete acknowledged zero-refund, mixed, and collection flows

**Files:**

- Modify: `src/db/schema.ts`
- Modify: `src/domain/refunds/return-request.ts`
- Modify: `src/domain/refunds/return-request.test.ts`
- Modify: `src/application/refunds/use-cases/reject-return.use-case.ts`
- Create: `src/application/refunds/use-cases/complete-no-refund-return.use-case.ts`
- Modify: `src/application/refunds/use-cases/confirm-return-otp.use-case.ts`
- Modify: `src/application/refunds/refund-workflow.use-cases.test.ts`
- Modify: `src/application/refunds/refunds.container.ts`
- Modify: `src/infrastructure/database/repositories/refunds/return-request.repository.ts`
- Modify: `src/infrastructure/database/repositories/refunds/refund-payout.repository.ts`
- Modify: `src/server/routers/public/returns.ts`
- Modify: `src/server/routers/admin/returns.ts`
- Modify: `src/components/account/order-detail/ReturnProposalDialog.tsx`

**State change:** Add `not_required` to the payout-status enum/domain type so a completed zero-refund decision is distinguishable from a pending payout.

- [ ] **Step 1: Write failing zero-refund lifecycle tests**

Assert an admin rejection creates a versioned zero-refund proposal and cannot directly set terminal `rejected`. The customer must open for ten seconds and acknowledge. After acknowledgment, `completeNoRefund` records the decision, releases reservations, sets physical disposition without stock changes, and sets payout status `not_required` without creating an OTP or payout row.

- [ ] **Step 2: Write mixed-outcome tests**

A proposal containing approved and rejected lines must:

- require OTP because `totalRefund > 0`;
- restock only the approved resellable quantities;
- release the rejected-line reservations only when the decision is finalized;
- keep `collectionDue` separate from the positive refund.

- [ ] **Step 3: Replace direct rejection with a proposal**

Rename the use case internally to express proposal creation, or keep the exported name only if changing it would create noisy churn. The repository must write `reviewNote`, per-line rejected outcomes, and an immutable zero-refund proposal, then move to `awaiting_customer_confirmation`.

- [ ] **Step 4: Add the no-OTP public mutation**

```ts
completeNoRefund({ requestId, proposalVersion });
```

It must enforce ownership, current version, `acknowledgedAt`, `totalRefund === 0`, and the read gate. It must be idempotent for the already-completed same version.

- [ ] **Step 5: Correct collection handling everywhere**

Remove `- collectionDue` from the finalization integrity calculation. Payout preparation uses `proposal.totalRefund` only. If the customer asks to ship a rejected item back, record the collection obligation/action separately; free in-store pickup remains available and must not block finalization.

- [ ] **Step 6: Apply the enum addition and verify**

Run `pnpm db:push`; do not run `pnpm db:migrate`.

```bash
pnpm vitest run src/domain/refunds/return-request.test.ts src/application/refunds/refund-workflow.use-cases.test.ts src/application/refunds/refund-payout.service.test.ts
pnpm type-check
```

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts src/domain/refunds src/application/refunds src/infrastructure/database/repositories/refunds src/server/routers src/components/account/order-detail/ReturnProposalDialog.tsx
git commit -m "fix(refunds): Complete acknowledged return outcomes"
```

---

## Task 6: Serialize and rate-limit OTP issuance

**Files:**

- Modify: `src/db/schema.ts`
- Modify: `src/application/refunds/refund-otp.service.ts`
- Modify: `src/application/refunds/refund-otp.service.test.ts`
- Modify: `src/application/refunds/use-cases/request-return-otp.use-case.ts`
- Modify: `src/application/refunds/refund-workflow.use-cases.test.ts`
- Modify: `src/application/refunds/refunds.container.ts`
- Modify: `src/infrastructure/database/repositories/refunds/refund-otp-challenge.repository.ts`
- Create: `src/infrastructure/database/repositories/refunds/refund-otp-challenge.repository.integration.test.ts`
- Modify: `src/server/utils/rate-limiter.ts`
- Modify: `src/server/routers/public/returns.ts`

**Limits:**

- Database resend cooldown: one send per request/proposal every 60 seconds.
- Upstash/fallback limits: 10 sends per IP per 15 minutes, 5 per account per 15 minutes, and 5 per normalized verified phone per 15 minutes.
- Verification stays at five wrong attempts per challenge and a 60-second expiry.

- [ ] **Step 1: Write the concurrent resend integration test**

Run two `replaceActive()` calls simultaneously for one request/proposal. Assert one challenge is active, the other returns a cooldown/conflict result, and both plaintext codes are never usable.

- [ ] **Step 2: Serialize replacement on the return request**

In `replaceActive()` lock the parent `return_requests` row first, inspect the newest challenge with the database clock, reject sends inside the 60-second cooldown, invalidate any prior active row, then insert. Add a partial unique index for at most one row where `consumed_at IS NULL AND invalidated_at IS NULL` as defense in depth.

Expired rows must be invalidated before insertion so they do not block the partial unique constraint.

- [ ] **Step 3: Add abuse-limit ports and tests**

The use case receives `clientIp`; after resolving the verified phone, enforce all three identifiers before challenge creation. Normalize/hash the phone before using it as a rate-limit key so the key is stable and does not expose the phone in logs. Use the existing Upstash-plus-memory-fallback behavior.

- [ ] **Step 4: Correct service tests**

Delete the test that permits immediate resend. Add cases for 59 seconds rejected, 60 seconds accepted, old challenge invalidated, provider failure invalidating the new challenge, and a proposal-version change invalidating earlier challenges.

- [ ] **Step 5: Apply schema and run focused verification**

Run `pnpm db:push`, then:

```bash
pnpm vitest run src/application/refunds/refund-otp.service.test.ts src/application/refunds/refund-workflow.use-cases.test.ts src/server/utils/memory-rate-limiter.test.ts
pnpm vitest run --config vitest.integration.config.ts src/infrastructure/database/repositories/refunds/refund-otp-challenge.repository.integration.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/application/refunds src/infrastructure/database/repositories/refunds src/server
git commit -m "fix(refunds): Harden OTP challenge issuance"
```

---

## Task 7: Wire every operational workflow to routes and UI

**Files:**

- Modify: `src/db/schema.ts`
- Modify: `src/db/relations.ts`
- Modify: `src/server/routers/public/returns.ts`
- Modify: `src/server/routers/admin/returns.ts`
- Modify: `src/server/admin-write-gating.test.ts`
- Modify: `src/server/routers/public/returns.ownership.test.ts`
- Modify: `src/application/refunds/use-cases/record-package-event.use-case.ts`
- Modify: `src/application/refunds/use-cases/open-carrier-claim.use-case.ts`
- Modify: `src/application/refunds/use-cases/review-return-dispute.use-case.ts`
- Create: `src/application/refunds/use-cases/process-due-carrier-claims.use-case.ts`
- Modify: `src/application/refunds/refunds.container.ts`
- Modify: `src/infrastructure/database/repositories/refunds/return-request.repository.ts`
- Modify: `src/infrastructure/database/repositories/refunds/refund-payout.repository.ts`
- Modify: `src/components/admin/returns/ReturnReview.tsx`
- Create: `src/components/admin/returns/ReturnInspectionForm.tsx`
- Create: `src/components/admin/returns/ReturnDisputePanel.tsx`
- Create: `src/components/account/order-detail/ReturnPackageDeclaration.tsx`
- Modify: `src/components/account/order-detail/ReturnRequestCard.tsx`
- Modify: `src/components/account/order-detail/ReturnProposalDialog.tsx`
- Modify: `src/app/admin/returns/page.tsx`
- Create: `src/app/api/internal/refunds/carrier-claims/route.ts`

**Required procedures:**

```text
public.returns.declarePackage
public.returns.submitDispute
public.returns.completeNoRefund
admin.returns.recordHandoff
admin.returns.recordReceivingCount
admin.returns.recordSecondCount
admin.returns.recordInspection
admin.returns.recordMediaException
admin.returns.reviewDispute
admin.returns.openCarrierClaim
admin.returns.resolveCarrierClaim
admin.returns.listEvidence
admin.returns.openEvidence
```

- [ ] **Step 1: Add router reachability and authorization tests**

Each use case must have exactly one route caller. Customer procedures enforce request ownership. Worker procedures record facts/evidence only. Decision, exception, claim-resolution, and dispute-review mutations require admin/super-admin. Opening media requires super admin.

- [ ] **Step 2: Make package events drive guarded workflow transitions**

`declarePackage` server-forces `kind="customer_declaration"`; callers cannot choose another kind. Staff handoff and receiving procedures similarly force their kinds and transition the request only when required evidence/counts exist. Corrections append a new event with `correctionOfId`; no event is overwritten.

- [ ] **Step 3: Build the staff inspection form**

Render each requested line with received, inspected, approved, outcome, and fault inputs only. Show calculated financial values only after the server returns the saved proposal. Workers see count/evidence controls but no decision controls; admins/super admins see inspection/proposal controls.

- [ ] **Step 4: Build customer package and dispute controls**

Add package count, seal confirmation, three-units-per-package guidance, courier-video upload, and a detailed dispute form. Replace the current “contact support” dead end with `public.returns.submitDispute`.

- [ ] **Step 5: Make carrier claims operational**

Expose admin open/resolve controls. `processDueCarrierClaims` locks due open claims, creates the protected missing-quantity proposal after three calendar days without resolution, marks the claim `authorization_pending`, and remains idempotent. It must never call a payout provider without the normal customer acknowledgment/OTP authorization. Add `authorization_pending` to the carrier-claim status enum; change it to `refunded_after_deadline` only when the corresponding payout receives a verified `succeeded` observation.

Add an internal POST route authenticated by `RETURN_JOBS_SECRET`; it calls the due-claim processor and returns counts only. Document that production must schedule this route. Do not hardcode a hosting-specific scheduler config.

- [ ] **Step 6: Apply the carrier-status enum addition**

Run `pnpm db:push`, inspect the SQL, and confirm it only adds the new enum value and any required supporting index. Do not run `pnpm db:migrate`.

- [ ] **Step 7: Add component/use-case tests**

Cover a full reachable lifecycle for:

1. customer declaration -> two photos -> pickup authorization;
2. handoff video/count -> receiving video -> second count -> inspection;
3. positive proposal -> acknowledgment -> OTP;
4. zero proposal -> acknowledgment -> no-OTP completion;
5. dispute -> admin review -> super-admin final escalation;
6. missing quantity -> open claim -> three-day due proposal.

- [ ] **Step 8: Run focused verification**

```bash
pnpm vitest run src/application/refunds src/server/admin-write-gating.test.ts src/server/routers/public/returns.ownership.test.ts
pnpm lint
pnpm type-check
```

- [ ] **Step 9: Commit**

```bash
git add src/db src/application/refunds src/infrastructure/database/repositories/refunds src/server src/components/admin/returns src/components/account/order-detail src/app/admin/returns src/app/api/internal/refunds
git commit -m "feat(refunds): Complete return operations workflow"
```

---

## Task 8: Remove the legacy bypass and invalidate stock caches

**Files:**

- Modify: `src/domain/orders/entities/order.entity.ts`
- Modify: `src/domain/orders/interfaces/repositories/order.repository.interface.ts`
- Modify: `src/infrastructure/database/repositories/orders/order.repository.ts`
- Modify: `src/infrastructure/database/repositories/orders/order.repository.integration.test.ts`
- Rename or modify: `src/application/orders/use-cases/refund-order.use-case.ts`
- Modify/delete: `src/application/orders/use-cases/refund-order.use-case.test.ts`
- Modify: `src/application/refunds/refunds.container.ts`
- Create: `src/server/utils/revalidate-return-finalization.ts`
- Create: `src/server/utils/revalidate-return-finalization.test.ts`
- Modify: `src/server/routers/public/returns.ts`
- Modify: `src/server/order-stock-cache-invalidation.test.ts`

- [ ] **Step 1: Write a source-level bypass regression**

Assert `OrderRepositoryInterface` exposes no `refund()` method, `DrizzleOrderRepository` has no direct refund implementation, and no router/application caller can submit arbitrary `RefundLine[]` outside the return-request workflow.

- [ ] **Step 2: Delete the legacy path**

Remove `RefundLine`, `OrderEntity.validateRefund()`, `OrderEntity.refundValue()`, `OrderRepositoryInterface.refund()`, `DrizzleOrderRepository.refund()`, and the direct-refund integration tests. Preserve shared order helpers only if the authorized return repository actually uses them.

Rename `RefundOrderUseCase` to `FinalizeAuthorizedReturnUseCase` so the remaining class cannot be confused with the deleted bypass. Its input remains request id, customer id, and proposal version only.

- [ ] **Step 3: Return an explicit physical-change result**

Finalization returns:

```ts
{
  request: ReturnRequestRecord;
  stockChanged: boolean;
}
```

`stockChanged` is true only when a committed transaction increased one or more variant stock quantities. Idempotent replays return false.

- [ ] **Step 4: Revalidate through a shared boundary**

`revalidate-return-finalization.ts` awaits the finalization result and calls `revalidateCatalogue()` exactly once when `stockChanged` is true. Use it from positive OTP completion, zero-refund completion, and any carrier-claim completion path. Do not call Next cache APIs from domain/application/database layers.

- [ ] **Step 5: Correct the cache regression test**

Replace the stale expectation for the removed admin refund mutation with assertions that every authorized return-completion route goes through the shared revalidation helper and a non-restocking decision does not invalidate.

- [ ] **Step 6: Run focused verification**

```bash
pnpm vitest run src/server/order-stock-cache-invalidation.test.ts src/server/utils/revalidate-return-finalization.test.ts src/application/orders/use-cases
pnpm vitest run --config vitest.integration.config.ts src/infrastructure/database/repositories/orders/order.repository.integration.test.ts
pnpm lint
pnpm type-check
```

- [ ] **Step 7: Commit**

```bash
git add src/domain/orders src/infrastructure/database/repositories/orders src/application/orders src/application/refunds src/server
git commit -m "refactor(refunds): Remove direct refund bypass"
```

---

## Task 9: Run release-grade verification and update handoff documentation

**Files:**

- Modify: `docs/REFUNDS.md`
- Modify: `docs/PRELAUNCH-HANDOFF.md`
- Modify: `AGENTS.md` only if the verified test counts or refund architecture summary changed

- [ ] **Step 1: Confirm branch and task isolation**

```bash
git status --short --branch
git log --oneline main..HEAD
```

Expected: Tasks 1-8 each have one distinct commit and the worktree contains no unrelated changes.

- [ ] **Step 2: Run the refund-focused unit suite**

```bash
pnpm vitest run src/domain/refunds src/application/refunds src/infrastructure/services/uploadthing-evidence-storage.service.test.ts src/server/admin-write-gating.test.ts src/server/order-stock-cache-invalidation.test.ts src/server/routers/public/returns.ownership.test.ts src/server/routers/admin/return-inspection-input.test.ts
```

- [ ] **Step 3: Run all database integration coverage**

Use the configured development `DATABASE_URL` and run:

```bash
pnpm test:integration
```

Do not accept a timeout or a focused subset as a successful result. Record the exact file/test counts.

- [ ] **Step 4: Run full static/unit/build verification**

```bash
pnpm lint
Remove-Item -Recurse -Force -LiteralPath .next
pnpm type-check
pnpm test
pnpm build
```

Provide valid build-only secrets, including `STRIPE_SECRET_KEY`, rather than recording an environment failure as a code pass.

- [ ] **Step 5: Verify environment-owned privacy and jobs**

In a non-production environment:

1. Confirm UploadThing **Allow Overriding ACL** is enabled.
2. Upload one file through each evidence route and prove its raw URL/key is not publicly readable.
3. Prove `openEvidence` works only for super admin, expires after five minutes, and inserts one audit row.
4. Run `pnpm evidence:privatize` in dry-run mode, inspect the target count, then use `pnpm evidence:privatize -- --apply`; production additionally requires `--confirm-production`.
5. Invoke the carrier-claim internal route with missing/wrong/correct `RETURN_JOBS_SECRET` and prove only the correct request processes due claims.

- [ ] **Step 6: Run authenticated browser smoke**

Exercise customer, worker, admin, and super-admin accounts through the six lifecycles listed in Task 7. Verify no role sees controls it cannot use and no response exposes billing addresses, evidence storage keys, arbitrary payout destinations, or provider credentials.

- [ ] **Step 7: Update documentation with evidence, not intentions**

Record exact passing counts, schema changes, the UploadThing ACL check, signed-link audit check, and any still-external provider blockers. Keep WhatsApp OTP and OPay marked fail-closed until real transports, authenticated callbacks/webhooks, and reconciliation pass in a provider sandbox.

- [ ] **Step 8: Commit**

```bash
git add docs/REFUNDS.md docs/PRELAUNCH-HANDOFF.md AGENTS.md
git commit -m "docs(refunds): Record remediation verification"
```

- [ ] **Step 9: Run the required final review**

Open one fresh review task with **Sol high** and review `main..HEAD` against:

- the original refund spec;
- all ten findings mapped above;
- the verification outputs from this task;
- schema concurrency, role gates, privacy, money invariants, and operational reachability.

Do not merge while any P0/P1 remains. Fix accepted review findings as additional isolated commits, rerun the affected focused tests plus full verification, then ask Sol high to re-review the final range.

---

## Execution handoff

This plan is sequential because Tasks 3-8 depend on the contracts and schema established earlier. For maximum context and the user’s model preference:

1. Create a fresh Codex project task/window for each implementation task.
2. Use Terra medium for Tasks 1-9.
3. Start each new task from the preceding task’s committed branch state.
4. Keep one commit per task; never combine tasks in one commit even if a temporary type error requires adjacent tasks to be implemented in one coding session.
5. After Task 9, create one fresh Sol high review task for the entire `main..HEAD` range.

**Confidence:** High for the internal code remediation. The only known external gaps are enabling UploadThing ACL overrides, scheduling the carrier-claim job, build secrets, and obtaining real WhatsApp/OPay provider contracts and sandbox verification.
