import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { getAuthTables } from "better-auth/db";
import { account, session, user, verification } from "../../auth-schema";

/**
 * Better Auth owns the shape of its own four tables, and `auth-schema.ts` is a
 * hand-checked copy of that shape. Nothing has ever compared the two, so a
 * version bump could add a column and the mismatch would only surface at
 * runtime — as a thrown `BetterAuthError` on the first write that needed it.
 *
 * That is exactly what happened on the `1.4.7` → `1.7.2` upgrade. 1.7 scopes
 * account identity by a new required `account.issuer` column
 * (https://better-auth.com/docs/guides/1-7-upgrade-guide#account-identity-is-scoped-by-issuer)
 * and this file was never regenerated. The failure was invisible until a write
 * needed it and then maximally confusing:
 *
 *   - `/sign-up/email` created the `user` row, threw on the `account` insert,
 *     and returned a bodyless 500 — leaving an orphan user with no password.
 *   - Google and Facebook then found that orphan, refused to implicitly link a
 *     provider to a local user whose `emailVerified` is false, and bounced the
 *     visitor back to the site still signed out with no error shown.
 *
 * One missing column, two unrelated-looking symptoms, nothing in `type-check`
 * or `lint` to catch either. Hence this test.
 *
 * It deliberately compares against `getAuthTables({})` — the tables Better Auth
 * requires of everyone — rather than against this app's resolved options. The
 * app's own `additionalFields` (`phone`, `birthday`) are ours to add and are
 * not what drifts on an upgrade; pulling in `src/lib/auth.ts` to see them would
 * drag `@/db` and a live `DATABASE_URL` into a suite that must run without one.
 */
describe("auth-schema.ts matches what Better Auth requires", () => {
  const drizzleTables = { user, session, account, verification };
  const authTables = getAuthTables({});

  // Better Auth names its fields in camelCase and only rewrites them when a
  // `fieldName` is configured; this schema spells the same columns in
  // snake_case. Normalising both sides is what makes the comparison about
  // which columns exist rather than how they are spelled.
  const normalize = (name: string) =>
    name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

  const columnNameOf = (fieldKey: string, field: { fieldName?: string }) =>
    normalize(field.fieldName ?? fieldKey);

  const columnNamesOf = (
    table: (typeof drizzleTables)[keyof typeof drizzleTables]
  ) =>
    new Set(
      getTableConfig(table).columns.map((column) => normalize(column.name))
    );

  // A required Better Auth column that is nullable in Drizzle would let a row
  // be written that Better Auth then cannot read back.
  const notNullColumnsOf = (
    table: (typeof drizzleTables)[keyof typeof drizzleTables]
  ) =>
    new Set(
      getTableConfig(table)
        .columns.filter((column) => column.notNull)
        .map((column) => normalize(column.name))
    );

  it("declares every table Better Auth expects", () => {
    const expected = Object.values(authTables)
      .map((table) => table.modelName)
      .sort();

    expect(Object.keys(drizzleTables).sort()).toEqual(expected);
  });

  for (const [modelName, definition] of Object.entries(authTables)) {
    const table = drizzleTables[modelName as keyof typeof drizzleTables];

    it(`declares every column Better Auth expects on "${modelName}"`, () => {
      const present = columnNamesOf(table);

      const missing = Object.entries(definition.fields)
        .map(([fieldKey, field]) => columnNameOf(fieldKey, field))
        .filter((columnName) => !present.has(columnName));

      // Named rather than counted, so a failure says which column to add.
      expect(missing).toEqual([]);
    });

    it(`marks every column Better Auth requires on "${modelName}" as NOT NULL`, () => {
      const notNull = notNullColumnsOf(table);

      const nullableButRequired = Object.entries(definition.fields)
        .filter(([, field]) => field.required)
        .map(([fieldKey, field]) => columnNameOf(fieldKey, field))
        .filter((columnName) => !notNull.has(columnName));

      expect(nullableButRequired).toEqual([]);
    });
  }

  it("enforces the (issuer, account_id) uniqueness 1.7 relies on", () => {
    // Better Auth resolves an OAuth identity with `findAccountByKey({ issuer,
    // accountId })` and declares this pair unique. Without the constraint the
    // same provider identity can be linked to two users, and the lookup then
    // picks one arbitrarily.
    const { uniqueConstraints, indexes } = getTableConfig(account);

    const pairs = [
      ...uniqueConstraints.map((constraint) =>
        constraint.columns.map((column) => column.name)
      ),
      ...indexes
        .filter((index) => index.config.unique)
        .map((index) =>
          (index.config.columns ?? []).map(
            (column) => (column as { name: string }).name
          )
        ),
    ];

    expect(pairs).toContainEqual(["issuer", "account_id"]);
  });
});
