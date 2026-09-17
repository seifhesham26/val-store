# SDD ledger — plan: docs/superpowers/plans/2026-09-15-inventory-adjustment-request-review.md

## Setup

- Starting HEAD: `27bebddb8b167116ef104ec35a941d87cf724153`
- Branch: `codex/prelaunch-readiness`
- Workspace: current clean feature checkout at `C:\dev\val-store`.
- Ruling: Work in the current checkout — it is clean and already on a non-main feature branch, while creating a second worktree was not requested — if wrong, the cost is that these commits live on the existing feature branch rather than a dedicated branch/worktree.
- Baseline: `rtk pnpm test` passed 768/768 tests across 72 files; Vitest emitted its pre-existing config-loader warning.
- Spec authority: `docs/superpowers/specs/2026-09-15-inventory-adjustment-request-review-design.md` read in full.

## Task checklist

- [x] Task 1: Encode the inventory policy as pure domain logic
- [x] Task 2: Add the inspection and immutable request schema
- [x] Task 3: Build transactional stock-state primitives
- [x] Task 4: Implement worker requests, green inspections, and admin decisions
- [x] Task 5: Expose the workflow through exact tRPC capabilities
- [x] Task 6: Use sellable stock in public catalogue and live scrolling data
- [x] Task 7: Enforce the same ceiling in cart controls and cart writes
- [x] Task 8: Make checkout, cancellation, returns, and shipping race-safe
- [x] Task 9: Reconcile variant creation and every admin stock write
- [x] Task 10: Build the staff request, inspection, and review interface
- [x] Task 11: Zero fake inventory safely
- [ ] Task 12: Complete regression verification and durable handoff

## Preflight consistency scan

| Tasks / scope   | Producer → consumer or shared surface                                    | Finding / ruling                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Task 1          | Own tests → policy implementation and operations types                   | Internally consistent; boundary expectations match the spec's 20/10 rules.                                                                                                                             |
| Task 2          | Integration assertions → schema, relations, SQL                          | Internally consistent; nullable history references and partial uniqueness agree with the spec.                                                                                                         |
| Task 3          | Reconciliation tests → transactional helpers and repository interfaces   | Internally consistent; removal of unlogged bypasses supports the global worker/no-direct-write constraint.                                                                                             |
| Task 4          | Use-case tests → repository workflow, DI, notifications                  | Internally consistent; validation and failure-isolation rules match the spec.                                                                                                                          |
| Task 5          | Gating scan → worker-only/admin-write procedures                         | Internally consistent; query/write asymmetry matches the existing tRPC tiers.                                                                                                                          |
| Task 6          | Public integration/registry tests → catalogue and live stock payloads    | Internally consistent; raw staff stock remains distinct from customer sellability.                                                                                                                     |
| Task 7          | Cart tests → cart repository/use cases/UI controls                       | Internally consistent; reductions above a lowered ceiling stay allowed and checkout remains authoritative.                                                                                             |
| Task 8          | Concurrency tests → order locks, quarantine, invalidation                | Internally consistent; the existing status machine only reaches `shipped` from `paid`, so the plan's shipping guard covers every legal transition.                                                     |
| Task 9          | Creation/adjustment tests → all opening/admin stock writers              | Internally consistent; no opening-stock log is required because creation is not an adjustment.                                                                                                         |
| Task 10         | Existing API → staff UI                                                  | Internally consistent; role-loading disables controls and does not alter server authorization.                                                                                                         |
| Task 11         | Dry-run/apply behavior → seed fixtures/reset script                      | Internally consistent; explicit `--apply` stock-only reset is authorized by the plan and excludes inspection creation.                                                                                 |
| Task 12         | All previous outputs → regression verification/docs                      | Internally consistent; documentation is updated only after measured checks.                                                                                                                            |
| Tasks 1 → 2     | Domain category/status vocabulary → schema enums/types                   | Clean: exact category/status sets align.                                                                                                                                                               |
| Tasks 1 → 3     | Policy functions/types → locked sellability/reconciliation               | Clean: domain remains Drizzle-free and infrastructure supplies flags.                                                                                                                                  |
| Tasks 2 → 3     | Tables/invariants → transactional helpers; shared integration test       | Clean: schema partial index is the final concurrency guard.                                                                                                                                            |
| Tasks 2 → 4     | `notificationTypeEnum` and records → notification/workflow               | Ruling: Task 2 owns the enum/schema addition; Task 4 consumes it and adds service/visual behavior rather than re-adding the enum — if wrong, the cost is only task-boundary reshuffling, not behavior. |
| Tasks 2 → 9     | Schema and shared integration fixture → opening-stock coverage           | Clean: later tests extend, not replace, the schema assertions.                                                                                                                                         |
| Tasks 3 → 4     | Stock lock/reconcile helpers → submit/review transactions                | Clean: lock order and current-stock delta semantics align.                                                                                                                                             |
| Tasks 3 → 6     | Batched sellability primitive/interface → product-variant sellable reads | Ruling: product-variant methods should delegate to the shared primitive where signatures allow, avoiding duplicated policy/predicate logic — if wrong, the cost is a small adapter refactor.           |
| Tasks 3 → 7     | Sellability repository contract → cart ceilings                          | Clean: cart never exposes Drizzle through domain/application layers.                                                                                                                                   |
| Tasks 3 → 8     | Variant lock/reconcile helpers → order transactions                      | Clean: stable variant ordering plus per-variant row locks preserves race safety.                                                                                                                       |
| Tasks 3 → 9     | Reconciliation and product repository surfaces → creation/admin writes   | Clean: Task 9 completes writer coverage after the primitive exists.                                                                                                                                    |
| Tasks 4 → 5     | DI/use cases → thin tRPC handlers                                        | Clean: routers contain no business logic.                                                                                                                                                              |
| Tasks 4 → 10    | Work-list records and actions → Requests UI                              | Clean: immutable originals and grouped sibling requests remain visible.                                                                                                                                |
| Tasks 5 → 9     | Shared inventory router/revalidation helper                              | Clean: Task 9 completes invalidation coverage without changing capability tiers.                                                                                                                       |
| Tasks 5 → 10    | Exact tRPC procedures → UI queries/mutations                             | Clean: names and roles match exactly.                                                                                                                                                                  |
| Tasks 6 → 7     | Live stock state and sellable variant methods → product/cart controls    | Clean: exact customer copy remains a UI concern driven by server state.                                                                                                                                |
| Tasks 6 → 8     | Shared availability semantics → checkout authority                       | Clean: checkout recomputes under lock rather than trusting cached payloads.                                                                                                                            |
| Tasks 7 → 8     | Cart behavior → final checkout/order enforcement                         | Clean: optimistic/UI ceilings do not replace transaction validation.                                                                                                                                   |
| Tasks 8 → 9     | Reconciliation helper and catalogue invalidation → remaining writers     | Clean: both follow the same lock/reconcile contract.                                                                                                                                                   |
| Tasks 9 → 10    | Inventory router/read models → role-correct inventory page               | Clean: admin direct adjustment and worker request actions remain separate.                                                                                                                             |
| Tasks 1–11 → 12 | Tests, schema state, UI, reset, commits → final docs                     | Clean: completion claims are gated on measured verification and smoke results.                                                                                                                         |

## Task execution

- Task 1: minor (deferred): add negative inspection-cycle boundaries so removing entry/open-cycle/close guards cannot leave tests green.
- Task 1: minor (deferred): explicitly prove low stock is fully sellable after all-fine/no pending inspection.
- Task 1: review found one Important issue: persistence records cannot represent a deleted nullable actor id while retaining the immutable name snapshot.
- Task 1: fix round 1/5 (1 addressed, 0 open — nullable persistence actor id with required live command actor id; commits `8bd372b..de74ef2`).
- Task 1: complete (commits `27bebdd..de74ef2`, review clean; two deferred minors).
- [x] Task 1: Encode the inventory policy as pure domain logic
- Ruling: Focused `*.integration.test.ts` commands in the plan must include `--config vitest.integration.config.ts` because the repository's default Vitest config explicitly excludes integration files — the spec requires the tests to execute, so the integration config is authoritative — if wrong, the cost is command-line divergence from the plan text, not product behavior.
- Task 2: minor (deferred): add negative requested/approved quantity integration cases so a regression from `> 0` to non-zero cannot pass.
- Task 2: complete (commits `de74ef2..8671ef2`, review clean; one deferred minor).
- [x] Task 2: Add the inspection and immutable request schema
- Ruling: `reconcileLowStockCycle` preserves Task 1's range-entry semantics rather than opening on every in-range write with a missing cycle — the spec says inspections open when stock _enters_ 1–20, and completed cycles stay open until 0 or >20 — if wrong, a legacy/inconsistent in-range variant missing its cycle would not self-heal until it exits and re-enters the range.
- Task 3: implementation complete at `b195b420418f61221ba7809e0f60bca1d8847c88`; implementer reports 15 unit tests, 14 integration tests, type-check, and lint passed; task review is pending by explicit user request.
- Task 2 deferred minor resolved during Task 3: negative requested/approved quantity integration coverage added.
- PAUSE: stop after Task 3 implementation; on resume, read `task-3-report.md`, package diff `8671ef2..b195b42`, and dispatch the Task 3 reviewer before starting Task 4.
- RESUMED: user requested continuation; Task 3 review dispatched before Task 4.
- Task 3: minor (deferred): add one batched sellability case with two existing variants in different pending states to prove correlation isolation.
- Task 3: complete (commits `8671ef2..b195b42`, review clean; one deferred minor).
- [x] Task 3: Build transactional stock-state primitives
- Task 3 deferred minor resolved during Task 4: two-variant batched sellability correlation isolation is covered.
- Task 4: complete (commits `b195b42..e684a0a`, review clean).
- [x] Task 4: Implement worker requests, green inspections, and admin decisions
- Ruling: `pendingCount` must use a use-case method that delegates to `repository.countPending()` rather than deriving a count by loading all work/history — this satisfies the thin-router/use-case boundary and preserves the purpose of the count query — if wrong, the cost is one extra method on `ListInventoryWorkUseCase` and its focused test.
- Task 5: complete (commit `714f276`; exact worker/admin capability tiers, registry coverage, and thin handlers verified).
- [x] Task 5: Expose the workflow through exact tRPC capabilities
- Task 6: complete (commit `762643d`; catalogue cards, product detail data, and live stock payloads publish derived stock and availability state).
- [x] Task 6: Use sellable stock in public catalogue and live scrolling data
- Task 7: complete (cart repository reads/adds, reconciliation alternatives, variant swaps, guest merges, and storefront controls all consume the sellable ceiling; reductions above a lowered ceiling remain allowed).
- Task 7 verification: focused unit tests 17/17, cart repository integration 1/1, full unit suite 814/814 across 76 files, lint clean, type-check clean, production build successful, and `git diff --check` clean.
- [x] Task 7: Enforce the same ceiling in cart controls and cart writes
- Task 8: implementation complete; order creation locks variants before order-item FK writes, validates derived sellability, and reconciles low-stock cycles. Cancellation and returns lock the order parent before reading refundable state, then lock variants in stable order. Shipping locks ordered variants and rejects pending damaged/missing requests with `InventoryQuarantineError`.
- Task 8: order-side catalogue invalidation is wired for checkout creation, admin cancellation/returns, Stripe expiry cancellation, and settled lazy expiry sweeps. The admin route maps quarantine to a conflict and the detail UI shows a red operational notice without exposing it through customer routes.
- Task 8 verification: order integration tests 16/16, cache/error presentation tests 7/7, full unit suite 821/821 across 78 files, lint clean, type-check clean, production build successful, formatting clean, and `git diff --check` clean.
- [x] Task 8: Make checkout, cancellation, returns, and shipping race-safe
- Task 9: opening stock now reconciles low-stock inspection cycles inside both single-variant and batched product creation transactions; opening balances create no inventory log, while admin adjustments retain the existing lock/log/reconcile path and preserve manual availability.
- Task 9 verification: focused unit and gating tests 10/10, inventory integration tests 32/32, type-check clean, formatting clean, and `git diff --check` clean. Existing catalogue invalidation is present on product, variant, and inventory write routes; no additional router changes were needed.
- [x] Task 9: Reconcile variant creation and every admin stock write
- Task 10: implemented the staff inventory workspace. The Requests tab groups pending inspections and requests, workers can submit immutable damaged/missing/extra reports or complete all-fine inspections, and admins/super admins can review requests with stale-stock projections, corrected-quantity explanations, and rejection explanations. Low-stock display now uses the approved 20-unit inspection threshold; the sidebar polls `pendingCount` every 30 seconds. The admin inventory read model also carries manual availability so the internal badge can distinguish manually unavailable variants from ordinary stock.
- Task 10 verification: focused UI policy tests 7/7, targeted ESLint clean, type-check clean, full unit suite 831/831 across 80 files, production build successful, formatting clean. Authenticated browser smoke was attempted through `/admin/inventory` but redirected to `/login?redirect=%2Fadmin%2Finventory&error=unauthorized`; no signed-in staff session was available, so the three-role smoke remains open.
- [x] Task 10: Build the staff request, inspection, and review interface
- Task 11: added zero-stock seed fixtures and `pnpm inventory:reset-development`. The command defaults to a dry run, requires `--apply` to write, refuses production, updates only recorded stock and timestamps, and leaves manual availability and inspection history untouched. The apply run on September 17, 2026 reset 29 development variants to zero; a follow-up dry run reported `0 -> 0` for every variant.
- Task 11 verification: reset helper tests 3/3, targeted ESLint clean, type-check clean, full unit suite 831/831 across 80 files, integration suite 94/94 across 8 files, production build successful, and `git diff --check` clean.
- [x] Task 11: Zero fake inventory safely
- Task 12 automated verification: focused inventory/storefront/order checks passed, clean-`.next` type-check passed, lint reported 0 problems, full unit tests passed 831/831 across 80 files, integration tests passed 94/94 across 8 files, build generated 72 pages successfully, and the branch diff was reviewed. Authenticated worker/admin/super-admin browser smoke remains the only required check not completed.
