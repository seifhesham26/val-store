/**
 * Address Use Cases
 */

import { AddressRepositoryInterface } from "@/domain/address/interfaces/repositories/address.repository.interface";
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

  /**
   * Delete a saved address.
   *
   * This used to fail silently for most customers. `orders.shipping_address_id`
   * referenced `addresses` with no ON DELETE clause, so any address attached to
   * an order raised a foreign key violation — and the account page's delete
   * mutation had no error handler, so the button did nothing at all. Orders now
   * carry their own copy of the address (`orders.shipping_address_snapshot`),
   * the constraint is `SET NULL`, and the delete goes through.
   *
   * The one address that cannot go is the last shipping address: checkout
   * requires one, so a customer with none has quietly locked themselves out of
   * ordering. Refused with an explanation rather than allowed and rediscovered
   * at the checkout step.
   *
   * Billing addresses are not held back — checkout defaults billing to the
   * shipping address, so a customer with no separate billing address can still
   * order.
   */
  async execute(id: string, userId: string): Promise<void> {
    const existing = await this.addressRepository.findById(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Address not found or access denied");
    }

    if (existing.addressType === "shipping") {
      const owned = await this.addressRepository.findByUserId(userId);
      const remainingShipping = owned.filter(
        (address) =>
          address.addressType === "shipping" && address.id !== existing.id
      );

      if (remainingShipping.length === 0) {
        throw new Error(
          "This is your only shipping address, and an order needs one. " +
            "Add another address first, then delete this one."
        );
      }
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
