/**
 * Address Use Cases
 */

import { AddressRepositoryInterface } from "@/domain/interfaces/repositories/address.repository.interface";
import { NewAddress, Address } from "@/db/schema";

export class GetUserAddressesUseCase {
  constructor(private readonly addressRepository: AddressRepositoryInterface) {}

  async execute(userId: string): Promise<Address[]> {
    return this.addressRepository.findByUserId(userId);
  }
}

export class CreateAddressUseCase {
  constructor(private readonly addressRepository: AddressRepositoryInterface) {}

  async execute(address: NewAddress): Promise<Address> {
    // If this is the first address, make it default
    const existing = await this.addressRepository.findByUserId(address.userId);
    if (existing.length === 0) {
      address.isDefault = true;
    }
    return this.addressRepository.create(address);
  }
}

export class UpdateAddressUseCase {
  constructor(private readonly addressRepository: AddressRepositoryInterface) {}

  async execute(
    id: string,
    userId: string,
    data: Partial<NewAddress>
  ): Promise<Address> {
    // Verify ownership
    const existing = await this.addressRepository.findById(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Address not found or access denied");
    }
    return this.addressRepository.update(id, data);
  }
}

export class DeleteAddressUseCase {
  constructor(private readonly addressRepository: AddressRepositoryInterface) {}

  async execute(id: string, userId: string): Promise<void> {
    // Verify ownership
    const existing = await this.addressRepository.findById(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Address not found or access denied");
    }
    return this.addressRepository.delete(id);
  }
}

export class SetDefaultAddressUseCase {
  constructor(private readonly addressRepository: AddressRepositoryInterface) {}

  async execute(userId: string, addressId: string): Promise<void> {
    // Verify ownership
    const existing = await this.addressRepository.findById(addressId);
    if (!existing || existing.userId !== userId) {
      throw new Error("Address not found or access denied");
    }
    return this.addressRepository.setDefault(userId, addressId);
  }
}
