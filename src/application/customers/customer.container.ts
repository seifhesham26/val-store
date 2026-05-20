/**
 * Customer Domain Container
 */

import { DrizzleCustomerRepository } from "@/infrastructure/database/repositories/customers/customer.repository";
import { DrizzleUserLookupRepository } from "@/infrastructure/database/repositories/customers/user-lookup.repository";
import { GetOrCreateCustomerUseCase } from "./use-cases/get-or-create-customer.use-case";

export function createCustomerModule() {
  let repo: DrizzleCustomerRepository | undefined;
  const getCustomerRepository = () =>
    (repo ??= new DrizzleCustomerRepository());

  let userLookupRepo: DrizzleUserLookupRepository | undefined;
  const getUserLookupRepository = () =>
    (userLookupRepo ??= new DrizzleUserLookupRepository());

  let getOrCreateCustomer: GetOrCreateCustomerUseCase | undefined;

  return {
    getCustomerRepository,
    getUserLookupRepository,
    getGetOrCreateCustomerUseCase: () =>
      (getOrCreateCustomer ??= new GetOrCreateCustomerUseCase(
        getCustomerRepository()
      )),
  };
}

export type CustomerModule = ReturnType<typeof createCustomerModule>;
