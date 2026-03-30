/**
 * Address Repository Interface
 */

import { Address, NewAddress } from "@/db/schema";

export interface AddressRepositoryInterface {
  findByUserId(userId: string): Promise<Address[]>;
  findById(id: string): Promise<Address | undefined>;
  create(address: NewAddress): Promise<Address>;
  update(id: string, address: Partial<NewAddress>): Promise<Address>;
  delete(id: string): Promise<void>;
  setDefault(userId: string, addressId: string): Promise<void>;
}
