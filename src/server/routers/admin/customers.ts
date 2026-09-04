/**
 * Admin Customers Router
 *
 * List registered users and their order history.
 */

import { router, adminProcedure } from "@/server/trpc";
import { z } from "zod";
import { db } from "@/db";
import { user, orders } from "@/db/schema";
import { eq, desc, count, sql } from "drizzle-orm";
import {
  containsPattern,
  LIKE_ESCAPE_CHAR,
} from "@/domain/shared/like-pattern";
import { SUM_NET_REVENUE } from "@/infrastructure/database/queries/revenue";

export const adminCustomersRouter = router({
  /**
   * List all customers (users) with order stats
   */
  list: adminProcedure
    .input(
      z
        .object({
          limit: z.number().int().positive().max(100).optional(),
          offset: z.number().int().min(0).optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const search = input?.search?.trim();

      // Built once and used by both the row query and the count below. They
      // used to disagree: the filter applied to the rows while `total` was an
      // unconditional COUNT(*) over every user, so searching for one customer
      // still told the pager there were hundreds of pages.
      const pattern = containsPattern(search);
      const searchWhere = pattern
        ? sql`(${user.name} ILIKE ${pattern} ESCAPE ${LIKE_ESCAPE_CHAR} OR ${user.email} ILIKE ${pattern} ESCAPE ${LIKE_ESCAPE_CHAR})`
        : undefined;

      // Get users with order counts
      let query = db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          createdAt: user.createdAt,
          orderCount: count(orders.id),
          // The shared definition, so a customer's lifetime value and the
          // dashboard cannot give different answers about the same money.
          totalSpent: sql<string>`${SUM_NET_REVENUE}`,
        })
        .from(user)
        .leftJoin(orders, eq(user.id, orders.userId))
        .groupBy(user.id)
        .orderBy(desc(user.createdAt))
        .limit(limit)
        .offset(offset);

      if (searchWhere) {
        query = query.where(searchWhere) as typeof query;
      }

      // Independent queries — the count does not read the page. Issued
      // together so postgres.js pipelines them down one connection and the
      // pair costs about one round trip instead of two.
      const [customers, [{ total }]] = await Promise.all([
        query,
        // Same predicate as the rows above.
        db.select({ total: count() }).from(user).where(searchWhere),
      ]);

      return {
        customers: customers.map((c) => ({
          ...c,
          orderCount: Number(c.orderCount),
          totalSpent: c.totalSpent ? parseFloat(c.totalSpent) : 0,
        })),
        total,
      };
    }),

  /**
   * Get customer details with orders
   */
  getById: adminProcedure
    .input(
      z.object({
        id: z.string(),
        orderLimit: z.number().int().positive().max(100).optional(),
        orderOffset: z.number().int().min(0).optional(),
      })
    )
    .query(async ({ input }) => {
      const limit = input.orderLimit ?? 20;
      const offset = input.orderOffset ?? 0;

      // Three independent reads, so they go down the connection together —
      // ~1 round trip rather than 3. The orders and totals queries are keyed
      // on the same id the customer lookup uses, so nothing here waits on
      // anything else here; the "does this customer exist" check just moves
      // below the fetch instead of gating it.
      const [customer, customerOrders, [totals]] = await Promise.all([
        db.query.user.findFirst({ where: eq(user.id, input.id) }),
        // Bounded. This used to load every order the customer had ever
        // placed, with every line item and every joined product row —
        // unbounded in the number of orders, on a dialog that renders a
        // summary list.
        db.query.orders.findMany({
          where: eq(orders.userId, input.id),
          orderBy: [desc(orders.createdAt)],
          limit,
          offset,
          with: {
            items: {
              with: {
                product: true,
              },
            },
          },
        }),
        // Aggregated in SQL rather than folded over the rows above: those are
        // now one page, so deriving totals from them would report the first 20
        // orders as the customer's lifetime figures.
        //
        // `totalSpent` uses the shared revenue definition, so a customer who
        // abandoned three checkouts and cancelled a fourth no longer reads as
        // a high-value account.
        db
          .select({
            orderCount: count(),
            totalSpent: sql<string>`${SUM_NET_REVENUE}`,
          })
          .from(orders)
          .where(eq(orders.userId, input.id)),
      ]);

      if (!customer) return null;

      return {
        ...customer,
        orderCount: Number(totals?.orderCount ?? 0),
        totalSpent: totals?.totalSpent ? parseFloat(totals.totalSpent) : 0,
        orders: customerOrders,
        orderLimit: limit,
        orderOffset: offset,
      };
    }),

  /**
   * Get customer count
   */
  getCount: adminProcedure.query(async () => {
    const [{ total }] = await db.select({ total: count() }).from(user);
    return total;
  }),
});
