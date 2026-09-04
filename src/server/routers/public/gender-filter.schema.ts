/**
 * The `gender` filter accepted by `public.products.list`.
 *
 * Split out of `products.ts` into its own module for one reason: that
 * router imports `container`, which reaches a live database connection at
 * module load (`@/db`), so it cannot be imported from a unit test that has
 * no database. This file imports only `zod` and the pure `pgEnum`
 * declaration from `@/db/schema` — no connection, safe to import anywhere —
 * so the validation itself stays testable in isolation.
 */

import { z } from "zod";
import { genderEnum } from "@/db/schema";

/**
 * The four values `products.gender` can hold, taken from the `pgEnum`
 * itself rather than retyped by hand so the two cannot drift apart.
 *
 * Before this existed, the router accepted `gender: z.string().optional()`
 * and the repository force-cast whatever arrived straight onto the enum
 * column, so `gender: "foo"` reached Postgres and came back as an unhandled
 * `invalid input value for enum` — a 500 where a 400 belongs. Validating
 * here means an invalid value never leaves the router.
 */
export const genderFilterSchema = z.enum(genderEnum.enumValues).optional();
