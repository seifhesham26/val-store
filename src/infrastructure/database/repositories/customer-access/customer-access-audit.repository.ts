import { db } from "@/db";
import { customerDataAccessAudits } from "@/db/schema";
import type {
  CustomerAccessAuditRecord,
  CustomerAccessAuditRepository,
  NewCustomerAccessAuditRecord,
} from "@/domain/customer-access/customer-access-audit.repository";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";

export class DrizzleCustomerAccessAuditRepository implements CustomerAccessAuditRepository {
  async record(
    input: NewCustomerAccessAuditRecord
  ): Promise<CustomerAccessAuditRecord> {
    return db.transaction(async (tx) => {
      await tx
        .delete(customerDataAccessAudits)
        .where(
          lt(
            customerDataAccessAudits.createdAt,
            sql<Date>`now() - interval '12 months'`
          )
        );

      const [record] = await tx
        .insert(customerDataAccessAudits)
        .values(input)
        .returning();

      if (!record) throw new Error("Customer access audit insert failed");
      return record;
    });
  }

  async hasValidSupportGrant(input: {
    accessId: string;
    actorUserId: string;
    subjectUserId: string;
  }): Promise<boolean> {
    const createdAfter = new Date(Date.now() - 30 * 60 * 1000);
    const [grant] = await db
      .select({ id: customerDataAccessAudits.id })
      .from(customerDataAccessAudits)
      .where(
        and(
          eq(customerDataAccessAudits.id, input.accessId),
          eq(customerDataAccessAudits.actorUserId, input.actorUserId),
          eq(customerDataAccessAudits.subjectUserId, input.subjectUserId),
          eq(customerDataAccessAudits.action, "customer_lookup"),
          eq(customerDataAccessAudits.confirmedCustomerRequest, true),
          gte(customerDataAccessAudits.createdAt, createdAfter)
        )
      )
      .limit(1);

    return Boolean(grant);
  }

  async listByActor(input: {
    actorUserId: string;
    actorRole?: CustomerAccessAuditRecord["actorRole"];
    limit: number;
    offset: number;
  }): Promise<{ events: CustomerAccessAuditRecord[]; total: number }> {
    const retainedActorEvents = and(
      eq(customerDataAccessAudits.actorUserId, input.actorUserId),
      input.actorRole
        ? eq(customerDataAccessAudits.actorRole, input.actorRole)
        : undefined,
      gte(
        customerDataAccessAudits.createdAt,
        sql<Date>`now() - interval '12 months'`
      )
    );

    const [events, [{ total }]] = await Promise.all([
      db
        .select()
        .from(customerDataAccessAudits)
        .where(retainedActorEvents)
        .orderBy(desc(customerDataAccessAudits.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(customerDataAccessAudits)
        .where(retainedActorEvents),
    ]);

    return { events, total: total ?? 0 };
  }
}
