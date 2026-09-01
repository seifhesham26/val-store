import { appRouter } from "@/server";
import { createDirectContext } from "@/server/trpc";

/**
 * A server-side tRPC caller for anonymous storefront data.
 *
 * Server components used to have no way to reach the storefront procedures, so
 * pages that needed a product grid shipped a client component that fetched it
 * over HTTP after hydrating. This calls the same procedures in-process — no
 * HTTP, no serialisation round trip, no waiting for the bundle.
 *
 * Anonymous on purpose. Everything reached through this must be a
 * `publicProcedure`: calling a protected one would throw UNAUTHORIZED, which is
 * the correct outcome — server-rendered storefront data is shared between
 * visitors and must never depend on who is asking.
 */
export function createAnonymousCaller() {
  return appRouter.createCaller(createDirectContext(null));
}
