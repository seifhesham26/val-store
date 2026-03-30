/**
 * Address Domain Container
 */

import { DrizzleAddressRepository } from "@/infrastructure/database/repositories/address/address.repository";
import {
  GetUserAddressesUseCase,
  CreateAddressUseCase,
  UpdateAddressUseCase,
  DeleteAddressUseCase,
  SetDefaultAddressUseCase,
} from "./use-cases/address.use-cases";

export function createAddressModule() {
  let repo: DrizzleAddressRepository | undefined;
  const getAddressRepository = () => (repo ??= new DrizzleAddressRepository());

  let getUserAddresses: GetUserAddressesUseCase | undefined;
  let createAddress: CreateAddressUseCase | undefined;
  let updateAddress: UpdateAddressUseCase | undefined;
  let deleteAddress: DeleteAddressUseCase | undefined;
  let setDefaultAddress: SetDefaultAddressUseCase | undefined;

  return {
    getAddressRepository,
    getGetUserAddressesUseCase: () =>
      (getUserAddresses ??= new GetUserAddressesUseCase(
        getAddressRepository()
      )),
    getCreateAddressUseCase: () =>
      (createAddress ??= new CreateAddressUseCase(getAddressRepository())),
    getUpdateAddressUseCase: () =>
      (updateAddress ??= new UpdateAddressUseCase(getAddressRepository())),
    getDeleteAddressUseCase: () =>
      (deleteAddress ??= new DeleteAddressUseCase(getAddressRepository())),
    getSetDefaultAddressUseCase: () =>
      (setDefaultAddress ??= new SetDefaultAddressUseCase(
        getAddressRepository()
      )),
  };
}

export type AddressModule = ReturnType<typeof createAddressModule>;
