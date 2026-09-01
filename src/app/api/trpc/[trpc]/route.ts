import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server";
import { createContext } from "@/server/trpc";
import type { TRPCContext } from "@/server/trpc";
import { cacheControlFor } from "@/server/utils/response-cache-policy";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,

    /**
     * Catalogue reads are identical for every anonymous visitor and change only
     * when an admin edits something, but every one of them was reaching Node
     * and then the database. This lets a shared cache answer them instead.
     *
     * The decision itself lives in `response-cache-policy` — pure, and tested
     * exhaustively, because caching the wrong response publicly would serve one
     * customer's data to another. See that module for the rule and why the
     * "did anything resolve the user" check is the load-bearing one.
     *
     * Note this stays correct for a signed-in customer browsing the catalogue:
     * their request carries cookies, but a public procedure never reads them,
     * so the response it produces is the anonymous one and is safe to share.
     */
    responseMeta({ ctx, type, errors, paths }) {
      // A context is always present in practice; if creating one failed there
      // is no way to know whether auth was touched, so treat it as private.
      const touchedAuth = ctx ? (ctx as TRPCContext).touchedAuth() : true;

      return {
        headers: {
          "cache-control": cacheControlFor({
            touchedAuth,
            type,
            errorCount: errors.length,
            pathCount: paths?.length ?? 0,
          }),
        },
      };
    },
  });

export { handler as GET, handler as POST };
