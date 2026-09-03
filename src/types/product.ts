/**
 * Shared product types for code that must not pull Drizzle into its bundle.
 *
 * `import type` is erased entirely at compile time, so a client component can
 * import from here without `@/db/schema` — and the ~200KB of Drizzle behind
 * it — reaching the browser. Deriving from `genderEnum` rather than retyping
 * the union by hand is what keeps this from drifting: adding a value to the
 * `pgEnum` widens this type automatically, and a stale hand-written copy is
 * exactly the enum/union drift a type audit looks for.
 */

import type { genderEnum } from "@/db/schema";

/** The gender facet a product can be filed under. */
export type Gender = (typeof genderEnum.enumValues)[number];
