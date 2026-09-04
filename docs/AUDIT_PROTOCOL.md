# Audit Protocol — Parallel Sub-Agent Deep Review

Use this file with Claude Code. Drop it in the repo root and say:
`"Follow AUDIT_PROTOCOL.md on this project."`

## Goal

Find every bug, security issue, and side effect in the codebase, using
parallel sub-agents (one per category), then keep re-auditing until a
full round produces zero new findings.

## Step 0 — Setup

Create `AUDIT_LOG.md` in the repo root if it doesn't exist. This is the
single source of truth for what's already been found. Every sub-agent
reads it before starting and appends to it when done — never overwrites it.

```markdown
# Audit Log

## Status: IN PROGRESS

## Round: 1

## Logic & Correctness

(pending)

## Security

(pending)

## Side Effects & State

(pending)

## Performance

(pending)

## Type Safety

(pending)
```

## Step 1 — Spawn one sub-agent per category (parallel, own context)

Launch these as separate sub-agents/tasks so they don't share context and
don't interfere with each other. Each gets the SAME instructions below,
scoped to its category only.

**Sub-agent prompt template (fill in {CATEGORY} and {CHECKLIST}):**

```
You are auditing this codebase for {CATEGORY} issues ONLY. Ignore
everything outside this category — other agents are covering it.

Read AUDIT_LOG.md first. Do not re-report anything already listed
under "## {CATEGORY}" unless you believe a prior entry was wrong
(mark it [DISPUTED] with reasoning, don't delete it).

Checklist to actively hunt for:
{CHECKLIST}

Go file by file, not just the obvious entry points. Check:
- Every function that takes external/user input
- Every async function and every place `await` is missing where needed
- Every place state is read AND written
- Every error path, not just the happy path

For each finding, append to AUDIT_LOG.md under "## {CATEGORY}":
- [FOUND] path/to/file.ts:LINE — one-sentence description — severity (low/med/high)

If you find nothing new after a thorough pass, append:
- [CLEAN] Round {N} — no new {CATEGORY} issues found

Do not fix anything. Only report.
```

### Category checklists

**Logic & Correctness**

- Off-by-one errors, incorrect conditionals, wrong operator precedence
- Null/undefined/empty-array not handled
- Incorrect assumptions about API response shape
- Edge cases: empty input, zero, negative numbers, very large input
- Async logic: race conditions, unhandled promise rejections, missing awaits

**Security**

- Unvalidated/unsanitized user input (forms, URL params, query strings)
- Auth/authorization checks missing on protected routes or actions
- Secrets, API keys, or tokens hardcoded or exposed client-side
- SQL/NoSQL injection surfaces, unsafe raw queries
- XSS via unescaped rendering (`dangerouslySetInnerHTML`, innerHTML, etc.)
- CORS misconfig, missing CSRF protection on state-changing requests
- Insecure direct object references (IDOR) — user A can access user B's data

**Side Effects & State**

- Mutating props or state directly instead of via setState/reducer
- Stale closures capturing old state/props
- useEffect with missing/incorrect dependency arrays
- Shared mutable state across requests (server-side) causing cross-user leakage
- Event listeners or subscriptions not cleaned up

**Performance**

- Unnecessary re-renders (missing memoization where it matters)
- N+1 queries / fetching in a loop instead of batching
- Large unoptimized assets or unbounded list rendering without virtualization
- Memory leaks: timers, listeners, or refs never released

**Type Safety**

- `any` used to silence real type errors
- Unsafe type assertions (`as X`) that could fail at runtime
- Optional fields accessed without narrowing

## Step 2 — Merge and re-round

After all sub-agents finish their pass:

1. Bump `## Round:` in AUDIT_LOG.md by 1.
2. Re-spawn the same 5 sub-agents for the new round, same rules (skip
   already-logged findings, only report new ones).
3. Track per-category consecutive clean rounds.

## Step 3 — Convergence / stop condition

Stop when **all 5 categories** have logged `[CLEAN]` for **2 consecutive
rounds in a row**. Set `## Status: CONVERGED` in AUDIT_LOG.md.

Do not stop after just one clean round — the first clean round often
means an agent got lazy, not that the code is actually clean. Two in a
row is the real signal.

## Step 4 — After convergence

Print a final summary table from AUDIT_LOG.md: category, total findings,
severity breakdown. Ask the user which findings to fix first (default:
all `high` severity, oldest first). Do not auto-fix without confirmation.
