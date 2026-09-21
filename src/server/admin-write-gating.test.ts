import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every admin mutation must be gated on `adminWriteProcedure`.
 *
 * This exists because the role model has one asymmetry that cannot be made to
 * fail closed in the type system: `adminProcedure` is the *permissive* tier
 * (worker and above), so a new mutation written with it is silently writable
 * by a read-only worker. Nothing about that is a type error — the procedure is
 * valid, the handler compiles, and the only symptom is a worker changing data
 * they were never meant to touch.
 *
 * So the check is a source scan rather than a runtime one. A runtime version
 * would have to build a caller per procedure and stub each repository, which
 * buys nothing here: the question is not "does the middleware work" (there are
 * tests for that) but "did someone forget to attach it".
 */

const ROUTER_DIRS = [
  "src/server/routers/admin",
  "src/server/routers/admin/settings",
];

/**
 * Mutations deliberately left on the read tier.
 *
 * All three touch only rows scoped to `ctx.user.id`. A read-only worker still
 * has a notification bell, and dismissing your own notification is not an edit
 * to anything another person can see. If this list grows, the addition needs
 * the same justification: self-scoped, invisible to everyone else.
 */
const SELF_SCOPED_EXCEPTIONS = new Set([
  "notifications.ts::markAsRead",
  "notifications.ts::markAllAsRead",
  "notifications.ts::delete",
]);

/**
 * Mutations gated even stricter than the write tier — `adminSuperProcedure`
 * (`super_admin` only), not `adminWriteProcedure`. A role change left on the
 * write tier would let a plain admin promote themselves to `super_admin`,
 * so this is the one case a mutation is *expected* to use a different
 * procedure than the rest.
 */
const SUPER_ADMIN_EXCEPTIONS = new Set(["customers.ts::updateRole"]);

/**
 * Mutations whose side effect is the audit row for an authorized read. They
 * intentionally do not grant a worker an admin-managed write.
 */
const AUDITED_ACCESS_MUTATIONS = new Map([
  ["customers.ts::supportLookup", "adminProcedure"],
  ["customers.ts::revealContact", "customerDirectoryProcedure"],
  ["orders.ts::revealDelivery", "adminProcedure"],
  ["orders.ts::recordExport", "customerDirectoryProcedure"],
]);

/** Inventory commands that workers alone may initiate. */
const WORKER_ONLY_MUTATIONS = new Set([
  "inventory.ts::submitRequest",
  "inventory.ts::completeInspection",
]);

/** Return evidence intake records a staff observation, not a refund decision. */
const STAFF_EVIDENCE_MUTATIONS = new Set(["returns.ts::recordEvidenceIntake"]);

/** The return queue is operational work, so workers must be able to read it. */
const WORKER_RETURN_QUERIES = new Set([
  "returns.ts::list",
  "returns.ts::getById",
  "returns.ts::pendingCount",
]);

/** Decisions in the return workflow must never be writable by a worker. */
const RETURN_DECISION_MUTATIONS = new Set([
  "returns.ts::authorizePickup",
  "returns.ts::recordInspection",
  "returns.ts::approveProposal",
  "returns.ts::reject",
  "returns.ts::mediaException",
]);

/** Customer-directory reads are intentionally narrower than the worker tier. */
const CUSTOMER_DIRECTORY_QUERIES = new Set([
  "customers.ts::list",
  "customers.ts::getById",
  "customers.ts::getCount",
]);

interface Procedure {
  file: string;
  name: string;
  procedure: string;
  isMutation: boolean;
}

function collectProcedures(): Procedure[] {
  const found: Procedure[] = [];

  for (const dir of ROUTER_DIRS) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
      if (entry.name.endsWith(".test.ts")) continue;

      const src = readFileSync(join(dir, entry.name), "utf8");

      // `  name: someProcedure` … up to the next property at the same indent.
      const re =
        /\n {2}(\w+): ((?:admin\w*|customerDirectory|worker|staffEvidence)Procedure)((?:(?!\n {2}\w+: )[\s\S])*)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        found.push({
          file: entry.name,
          name: m[1],
          procedure: m[2],
          isMutation: m[3].includes(".mutation("),
        });
      }
    }
  }

  return found;
}

describe("admin write gating", () => {
  const procedures = collectProcedures();

  it("finds the admin routers at all", () => {
    // Guards against the scan silently matching nothing after a refactor,
    // which would make every assertion below vacuously true.
    expect(procedures.length).toBeGreaterThan(40);
    expect(procedures.some((p) => p.isMutation)).toBe(true);
    expect(procedures.some((p) => !p.isMutation)).toBe(true);
  });

  it("gates every mutation on adminWriteProcedure or stricter", () => {
    const ungated = procedures
      .filter((p) => p.isMutation)
      .filter((p) => !SELF_SCOPED_EXCEPTIONS.has(`${p.file}::${p.name}`))
      .filter((p) => !SUPER_ADMIN_EXCEPTIONS.has(`${p.file}::${p.name}`))
      .filter((p) => !AUDITED_ACCESS_MUTATIONS.has(`${p.file}::${p.name}`))
      .filter((p) => !WORKER_ONLY_MUTATIONS.has(`${p.file}::${p.name}`))
      .filter((p) => !STAFF_EVIDENCE_MUTATIONS.has(`${p.file}::${p.name}`))
      .filter((p) => p.procedure !== "adminWriteProcedure")
      .map((p) => `${p.file} :: ${p.name} uses ${p.procedure}`);

    expect(ungated).toEqual([]);
  });

  it("keeps ordinary queries on the read tier and customer queries narrower", () => {
    const overGated = procedures
      .filter((p) => !p.isMutation)
      .filter((p) => {
        const key = `${p.file}::${p.name}`;
        if (CUSTOMER_DIRECTORY_QUERIES.has(key)) {
          return p.procedure !== "customerDirectoryProcedure";
        }
        if (WORKER_RETURN_QUERIES.has(key)) {
          return p.procedure !== "adminProcedure";
        }
        return p.procedure !== "adminProcedure";
      })
      .map((p) => `${p.file} :: ${p.name} uses ${p.procedure}`);

    expect(overGated).toEqual([]);
  });

  it("keeps the self-scoped notification mutations readable by a worker", () => {
    for (const key of SELF_SCOPED_EXCEPTIONS) {
      const [file, name] = key.split("::");
      const proc = procedures.find((p) => p.file === file && p.name === name);
      expect(proc, `${key} no longer exists`).toBeDefined();
      expect(proc!.isMutation).toBe(true);
      expect(proc!.procedure).toBe("adminProcedure");
    }
  });

  it("keeps role changes on the super-admin-only tier", () => {
    for (const key of SUPER_ADMIN_EXCEPTIONS) {
      const [file, name] = key.split("::");
      const proc = procedures.find((p) => p.file === file && p.name === name);
      expect(proc, `${key} no longer exists`).toBeDefined();
      expect(proc!.isMutation).toBe(true);
      expect(proc!.procedure).toBe("adminSuperProcedure");
    }
  });

  it("keeps audited data-access mutations on their exact read tiers", () => {
    for (const [key, expectedProcedure] of AUDITED_ACCESS_MUTATIONS) {
      const [file, name] = key.split("::");
      const proc = procedures.find((p) => p.file === file && p.name === name);
      expect(proc, `${key} no longer exists`).toBeDefined();
      expect(proc!.isMutation).toBe(true);
      expect(proc!.procedure).toBe(expectedProcedure);
    }
  });

  it("keeps worker inventory commands on the worker-only tier", () => {
    for (const key of WORKER_ONLY_MUTATIONS) {
      const [file, name] = key.split("::");
      const proc = procedures.find((p) => p.file === file && p.name === name);
      expect(proc, `${key} no longer exists`).toBeDefined();
      expect(proc!.isMutation).toBe(true);
      expect(proc!.procedure).toBe("workerProcedure");
    }
  });

  it("keeps return queue reads and evidence intake available to staff", () => {
    for (const key of WORKER_RETURN_QUERIES) {
      const [file, name] = key.split("::");
      const proc = procedures.find((p) => p.file === file && p.name === name);
      expect(proc, `${key} no longer exists`).toBeDefined();
      expect(proc!.isMutation).toBe(false);
      expect(proc!.procedure).toBe("adminProcedure");
    }
    for (const key of STAFF_EVIDENCE_MUTATIONS) {
      const [file, name] = key.split("::");
      const proc = procedures.find((p) => p.file === file && p.name === name);
      expect(proc, `${key} no longer exists`).toBeDefined();
      expect(proc!.isMutation).toBe(true);
      expect(proc!.procedure).toBe("staffEvidenceProcedure");
    }
  });

  it("keeps every return decision on the admin write tier", () => {
    for (const key of RETURN_DECISION_MUTATIONS) {
      const [file, name] = key.split("::");
      const proc = procedures.find((p) => p.file === file && p.name === name);
      expect(proc, `${key} no longer exists`).toBeDefined();
      expect(proc!.isMutation).toBe(true);
      expect(proc!.procedure).toBe("adminWriteProcedure");
    }
  });
});
