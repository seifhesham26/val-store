import { publicProcedure, router } from "@/server/trpc";

export const userRouter = router({
  /**
   * Who is signed in, or null.
   *
   * The one `publicProcedure` that genuinely needs auth: it is public because
   * an anonymous caller must get `null` rather than an error, not because the
   * answer is the same for everyone. Calling `getUser()` marks the request as
   * having touched auth, which is what keeps its response out of the shared
   * CDN cache — see `responseMeta` in the tRPC route handler.
   */
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.getUser();
  }),
});
