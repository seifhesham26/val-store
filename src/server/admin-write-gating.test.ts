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
        /\n {2}(\w+): (admin\w*Procedure)((?:(?!\n {2}\w+: )[\s\S])*)/g;
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

  it("gates every mutation on adminWriteProcedure", () => {
    const ungated = procedures
      .filter((p) => p.isMutation)
      .filter((p) => !SELF_SCOPED_EXCEPTIONS.has(`${p.file}::${p.name}`))
      .filter((p) => p.procedure !== "adminWriteProcedure")
      .map((p) => `${p.file} :: ${p.name} uses ${p.procedure}`);

    expect(ungated).toEqual([]);
  });

  it("leaves queries on the read tier, so a worker can see the screens", () => {
    const overGated = procedures
      .filter((p) => !p.isMutation)
      .filter((p) => p.procedure !== "adminProcedure")
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
});
