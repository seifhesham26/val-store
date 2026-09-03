import { describe, it, expect, vi } from "vitest";
import { DeleteAddressUseCase } from "./address.use-cases";
import type { AddressRepositoryInterface } from "@/domain/address/interfaces/repositories/address.repository.interface";
import type { Address } from "@/db/schema";

function address(over: Partial<Address> = {}): Address {
  return {
    id: "addr-1",
    userId: "user-1",
    addressType: "shipping",
    isDefault: false,
    fullName: "A Customer",
    addressLine1: "1 Street",
    addressLine2: null,
    city: "Cairo",
    state: "Cairo",
    postalCode: "11511",
    country: "EG",
    phone: "+201000000000",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as Address;
}

function repo(rows: Address[]): AddressRepositoryInterface {
  return {
    findById: vi.fn(async (id: string) => rows.find((r) => r.id === id)),
    findByUserId: vi.fn(async (userId: string) =>
      rows.filter((r) => r.userId === userId)
    ),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(async () => undefined),
    setDefault: vi.fn(),
  } as unknown as AddressRepositoryInterface;
}

describe("DeleteAddressUseCase", () => {
  it("deletes an address the caller owns", async () => {
    const rows = [address(), address({ id: "addr-2" })];
    const repository = repo(rows);

    await new DeleteAddressUseCase(repository).execute("addr-1", "user-1");

    expect(repository.delete).toHaveBeenCalledWith("addr-1");
  });

  it("refuses an address belonging to someone else", async () => {
    const repository = repo([address({ userId: "someone-else" })]);

    await expect(
      new DeleteAddressUseCase(repository).execute("addr-1", "user-1")
    ).rejects.toThrow(/not found or access denied/i);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("says the same thing for an id that does not exist", async () => {
    // One message for missing and for not-yours: distinguishing them confirms
    // an id exists.
    const repository = repo([]);

    await expect(
      new DeleteAddressUseCase(repository).execute("nope", "user-1")
    ).rejects.toThrow(/not found or access denied/i);
  });

  it("keeps the last shipping address — checkout needs one", async () => {
    const repository = repo([address()]);

    await expect(
      new DeleteAddressUseCase(repository).execute("addr-1", "user-1")
    ).rejects.toThrow(/only shipping address/i);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("counts only shipping addresses towards that floor", async () => {
    // A billing address is not a substitute: checkout cannot ship to it.
    const repository = repo([
      address(),
      address({ id: "addr-2", addressType: "billing" }),
    ]);

    await expect(
      new DeleteAddressUseCase(repository).execute("addr-1", "user-1")
    ).rejects.toThrow(/only shipping address/i);
  });

  it("deletes the last billing address freely", async () => {
    // Checkout defaults billing to shipping, so nothing breaks.
    const repository = repo([
      address(),
      address({ id: "addr-2", addressType: "billing" }),
    ]);

    await new DeleteAddressUseCase(repository).execute("addr-2", "user-1");

    expect(repository.delete).toHaveBeenCalledWith("addr-2");
  });

  it("does not count another customer's addresses towards the floor", async () => {
    const repository = repo([
      address(),
      address({ id: "addr-2", userId: "user-2" }),
    ]);

    await expect(
      new DeleteAddressUseCase(repository).execute("addr-1", "user-1")
    ).rejects.toThrow(/only shipping address/i);
  });
});
