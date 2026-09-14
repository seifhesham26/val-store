import type { RecordCustomerAccessUseCase } from "./record-customer-access.use-case";
import type {
  CustomerAccessActor,
  CustomerDataReadRepository,
} from "@/domain/customer-access/customer-data-read.repository";

export type CustomerContactRevealReason =
  | "customer_support"
  | "delivery_issue"
  | "account_correction"
  | "other";

export class RevealCustomerContactUseCase {
  constructor(
    private readonly customers: CustomerDataReadRepository,
    private readonly recordAccess: RecordCustomerAccessUseCase
  ) {}

  async execute(input: {
    actor: CustomerAccessActor;
    customerId: string;
    reason: CustomerContactRevealReason;
    reasonNote?: string;
  }) {
    const contact = await this.customers.findProtectedContact(input.customerId);
    if (!contact) return null;

    await this.recordAccess.execute({
      actorUserId: input.actor.id,
      actorName: input.actor.name,
      actorEmail: input.actor.email,
      actorRole: input.actor.role,
      subjectUserId: contact.id,
      orderId: null,
      action: "customer_reveal",
      fieldGroup: "customer_contact",
      reason: input.reason,
      reasonNote: input.reasonNote ?? null,
      confirmedCustomerRequest: false,
    });

    return {
      phone: contact.phone,
      shippingAddresses: contact.shippingAddresses,
    };
  }
}
