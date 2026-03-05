/**
 * Customer Domain Container
 */

import { DrizzleCustomerRepository } from "@/infrastructure/database/repositories/customer.repository";
import { GetOrCreateCustomerUseCase } from "./use-cases/get-or-create-customer.use-case";

export function createCustomerModule() {
  let repo: DrizzleCustomerRepository | undefined;
  const getCustomerRepository = () =>
    (repo ??= new DrizzleCustomerRepository());

  let getOrCreateCustomer: GetOrCreateCustomerUseCase | undefined;

  return {
    getCustomerRepository,
    getGetOrCreateCustomerUseCase: () =>
      (getOrCreateCustomer ??= new GetOrCreateCustomerUseCase(
        getCustomerRepository()
      )),
  };
}

export type CustomerModule = ReturnType<typeof createCustomerModule>;
