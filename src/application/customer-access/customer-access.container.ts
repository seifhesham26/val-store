import { DrizzleCustomerAccessAuditRepository } from "@/infrastructure/database/repositories/customer-access/customer-access-audit.repository";
import { RecordCustomerAccessUseCase } from "./record-customer-access.use-case";
import { StaffOrderAccessService } from "./staff-order-access.service";
import { ListStaffAccessAuditUseCase } from "./list-staff-access-audit.use-case";
import { DrizzleCustomerDataReadRepository } from "@/infrastructure/database/repositories/customer-access/customer-data-read.repository";
import { LookupCustomerSupportUseCase } from "./lookup-customer-support.use-case";
import { RevealCustomerContactUseCase } from "./reveal-customer-contact.use-case";
import type { OrderRepositoryInterface } from "@/domain/orders/interfaces/repositories/order.repository.interface";
import type { ReturnRequestRepositoryInterface } from "@/domain/refunds/interfaces/return-request.repository.interface";
import {
  OpenStaffOrderUseCase,
  RevealOrderDeliveryUseCase,
} from "./staff-order-use-cases";

export function createCustomerAccessModule(deps: {
  getOrderRepository: () => OrderRepositoryInterface;
  getReturnRequestRepository: () => ReturnRequestRepositoryInterface;
}) {
  let repository: DrizzleCustomerAccessAuditRepository | undefined;
  let recordAccess: RecordCustomerAccessUseCase | undefined;
  let staffOrderAccess: StaffOrderAccessService | undefined;
  let listStaffAccess: ListStaffAccessAuditUseCase | undefined;
  let customerData: DrizzleCustomerDataReadRepository | undefined;
  let lookupSupport: LookupCustomerSupportUseCase | undefined;
  let revealContact: RevealCustomerContactUseCase | undefined;
  let openStaffOrder: OpenStaffOrderUseCase | undefined;
  let revealOrderDelivery: RevealOrderDeliveryUseCase | undefined;

  const getCustomerAccessAuditRepository = () =>
    (repository ??= new DrizzleCustomerAccessAuditRepository());
  const getCustomerDataReadRepository = () =>
    (customerData ??= new DrizzleCustomerDataReadRepository());

  return {
    getCustomerAccessAuditRepository,
    getRecordCustomerAccessUseCase: () =>
      (recordAccess ??= new RecordCustomerAccessUseCase(
        getCustomerAccessAuditRepository()
      )),
    getStaffOrderAccessService: () =>
      (staffOrderAccess ??= new StaffOrderAccessService(
        getCustomerAccessAuditRepository()
      )),
    getListStaffAccessAuditUseCase: () =>
      (listStaffAccess ??= new ListStaffAccessAuditUseCase(
        getCustomerAccessAuditRepository()
      )),
    getLookupCustomerSupportUseCase: () =>
      (lookupSupport ??= new LookupCustomerSupportUseCase(
        getCustomerDataReadRepository(),
        new RecordCustomerAccessUseCase(getCustomerAccessAuditRepository())
      )),
    getRevealCustomerContactUseCase: () =>
      (revealContact ??= new RevealCustomerContactUseCase(
        getCustomerDataReadRepository(),
        new RecordCustomerAccessUseCase(getCustomerAccessAuditRepository())
      )),
    getOpenStaffOrderUseCase: () =>
      (openStaffOrder ??= new OpenStaffOrderUseCase(
        deps.getOrderRepository(),
        new StaffOrderAccessService(getCustomerAccessAuditRepository()),
        new RecordCustomerAccessUseCase(getCustomerAccessAuditRepository()),
        deps.getReturnRequestRepository()
      )),
    getRevealOrderDeliveryUseCase: () =>
      (revealOrderDelivery ??= new RevealOrderDeliveryUseCase(
        deps.getOrderRepository(),
        new StaffOrderAccessService(getCustomerAccessAuditRepository()),
        new RecordCustomerAccessUseCase(getCustomerAccessAuditRepository())
      )),
  };
}

export type CustomerAccessModule = ReturnType<
  typeof createCustomerAccessModule
>;
