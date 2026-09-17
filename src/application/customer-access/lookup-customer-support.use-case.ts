import type { RecordCustomerAccessUseCase } from "./record-customer-access.use-case";
import type {
  CustomerAccessActor,
  CustomerDataReadRepository,
} from "@/domain/customer-access/customer-data-read.repository";

export type WorkerSupportReason =
  | "order_status"
  | "delivery_problem"
  | "return_exchange"
  | "other";

export class LookupCustomerSupportUseCase {
  constructor(
    private readonly customers: CustomerDataReadRepository,
    private readonly recordAccess: RecordCustomerAccessUseCase
  ) {}

  async execute(input: {
    actor: CustomerAccessActor;
    email: string;
    reason: WorkerSupportReason;
    reasonNote?: string;
  }) {
    const customer = await this.customers.findSupportCustomerByExactEmail(
      input.email,
      100
    );
    const access = await this.recordAccess.execute({
      actorUserId: input.actor.id,
      actorName: input.actor.name,
      actorEmail: input.actor.email,
      actorRole: input.actor.role,
      subjectUserId: customer?.id ?? null,
      orderId: null,
      action: "customer_lookup",
      fieldGroup: "customer_history",
      reason: input.reason,
      reasonNote: input.reasonNote ?? null,
      confirmedCustomerRequest: true,
    });

    return { customer, supportAccessId: access.id };
  }
}
